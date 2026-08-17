import "server-only";

import { Pool } from "pg";

import { sqlite } from "./client";
import { isPostgresConfigured, postgresPoolConfig } from "./postgres-config";
import type {
  AnswerSource,
  AnswerFeedback,
  Conversation,
  ConversationDetail,
  ConversationMessage,
  DemoUser,
  ModelUsageOverview,
  NewUploadedFile,
  UploadedFile,
} from "./activity-types";

type DatabaseRow = Record<string, unknown>;

function date(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value));
  return new Date(String(value));
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T | null) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapUser(row: DatabaseRow): DemoUser {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    createdAt: date(row.created_at),
    lastSeenAt: date(row.last_seen_at),
  };
}

function mapConversation(row: DatabaseRow): Conversation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

function rankConversationSearch(items: Conversation[], query: string) {
  if (!query) return items;
  const needle = query.toLocaleLowerCase("th");
  const rank = (title: string) => {
    const normalized = title.toLocaleLowerCase("th");
    if (normalized === needle) return 0;
    if (normalized.startsWith(needle)) return 1;
    if (normalized.includes(needle)) return 2;
    return 3;
  };
  return items.sort((left, right) => {
    const relevance = rank(left.title) - rank(right.title);
    return relevance || right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function mapMessage(row: DatabaseRow): ConversationMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: row.role as ConversationMessage["role"],
    content: String(row.content),
    attachments: parseJson(row.attachments, []),
    createdAt: date(row.created_at),
  };
}

function mapFile(row: DatabaseRow): UploadedFile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    conversationId: row.conversation_id == null ? null : String(row.conversation_id),
    originalName: String(row.original_name),
    mediaType: String(row.media_type),
    sizeBytes: Number(row.size_bytes),
    objectPath: String(row.object_path),
    kind: row.kind as UploadedFile["kind"],
    status: row.status as UploadedFile["status"],
    analysis: parseJson<Record<string, unknown> | null>(row.analysis, null),
    createdAt: date(row.created_at),
  };
}

let postgresPool: Pool | null = null;
let postgresReady: Promise<void> | null = null;
let sqliteReady = false;

function getPostgresPool() {
  if (postgresPool) return postgresPool;
  postgresPool = new Pool(postgresPoolConfig({
    max: 8,
    connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 30_000,
  }));
  return postgresPool;
}

function isRecoverablePostgresConnectionError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
  const message = error instanceof Error ? error.message : String(error);
  return new Set(["ECONNRESET", "ECONNREFUSED", "EPIPE", "08000", "08003", "08006", "57P01", "57P02", "57P03"]).has(code) ||
    /ECONNRESET|ECONNREFUSED|Connection terminated|connection closed|socket hang up/i.test(message);
}

async function resetPostgresPool() {
  const stalePool = postgresPool;
  postgresPool = null;
  postgresReady = null;
  await stalePool?.end().catch(() => undefined);
}

async function ensurePostgresReady() {
  postgresReady ??= (async () => {
    const db = getPostgresPool();
    await db.query(`
      CREATE TABLE IF NOT EXISTS demo_users (
        id VARCHAR(128) PRIMARY KEY,
        display_name VARCHAR(191) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id VARCHAR(128) PRIMARY KEY,
        conversation_id VARCHAR(128) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS answer_sources (
        message_id VARCHAR(128) NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
        source_id VARCHAR(128) NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        PRIMARY KEY (message_id, source_id)
      );
      CREATE TABLE IF NOT EXISTS answer_feedback (
        message_id VARCHAR(128) NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
        user_id VARCHAR(128) NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
        value VARCHAR(8) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (message_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
        conversation_id VARCHAR(128) NULL REFERENCES conversations(id) ON DELETE SET NULL,
        original_name TEXT NOT NULL,
        media_type VARCHAR(191) NOT NULL,
        size_bytes BIGINT NOT NULL,
        object_path TEXT NOT NULL UNIQUE,
        kind VARCHAR(24) NOT NULL,
        status VARCHAR(24) NOT NULL,
        analysis JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS model_usage (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
        conversation_id VARCHAR(128) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        model_id VARCHAR(191) NOT NULL,
        input_tokens BIGINT NOT NULL,
        output_tokens BIGINT NOT NULL,
        total_tokens BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON conversation_messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_files_user_created ON uploaded_files(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_feedback_message ON answer_feedback(message_id);
      CREATE INDEX IF NOT EXISTS idx_model_usage_model_created ON model_usage(model_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_model_usage_user_created ON model_usage(user_id, created_at DESC);
    `);
  })();
  return postgresReady;
}

function ensureSqliteReady() {
  if (sqliteReady) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS demo_users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS answer_sources (
      message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      PRIMARY KEY (message_id, source_id)
    );
    CREATE TABLE IF NOT EXISTS answer_feedback (
      message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
      original_name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      object_path TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      analysis TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS model_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON conversation_messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_files_user_created ON uploaded_files(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_message ON answer_feedback(message_id);
    CREATE INDEX IF NOT EXISTS idx_model_usage_model_created ON model_usage(model_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_usage_user_created ON model_usage(user_id, created_at DESC);
  `);
  sqliteReady = true;
}

async function withStore<T>(postgres: () => Promise<T>, local: () => T | Promise<T>) {
  if (!isPostgresConfigured()) return local();
  try {
    return await postgres();
  } catch (error) {
    // The local Cloud SQL Auth Proxy can rotate/reconnect underneath a pooled
    // socket. One retry with a fresh pool keeps a transient reset from taking
    // down a visible Admin page, without hiding a real database error.
    if (!isRecoverablePostgresConnectionError(error)) throw error;
    await resetPostgresPool();
    return postgres();
  }
}

export const activityStorage = {
  async ensureUser(id: string, displayName = "Demo user") {
    const now = new Date();
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>(
        `INSERT INTO demo_users (id, display_name, created_at, last_seen_at)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           last_seen_at = EXCLUDED.last_seen_at
         RETURNING *`,
        [id, displayName, now],
      );
      return mapUser(result.rows[0]!);
    }, () => {
      ensureSqliteReady();
      sqlite.prepare(`
        INSERT INTO demo_users (id, display_name, created_at, last_seen_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          last_seen_at = excluded.last_seen_at
      `).run(id, displayName, now.getTime(), now.getTime());
      return mapUser(sqlite.prepare("SELECT * FROM demo_users WHERE id = ?").get(id) as DatabaseRow);
    });
  },

  async ensureConversation(id: string, userId: string, title: string) {
    const now = new Date();
    return withStore(async () => {
      await ensurePostgresReady();
      const existing = await getPostgresPool().query<DatabaseRow>(
        "SELECT * FROM conversations WHERE id = $1 LIMIT 1",
        [id],
      );
      if (existing.rows[0]) return mapConversation(existing.rows[0]);
      const result = await getPostgresPool().query<DatabaseRow>(
        `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4) RETURNING *`,
        [id, userId, title, now],
      );
      return mapConversation(result.rows[0]!);
    }, () => {
      ensureSqliteReady();
      const existing = sqlite.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as DatabaseRow | undefined;
      if (existing) return mapConversation(existing);
      sqlite.prepare(`INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .run(id, userId, title, now.getTime(), now.getTime());
      return mapConversation(sqlite.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as DatabaseRow);
    });
  },

  async ownsConversation(id: string, userId: string) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query("SELECT 1 FROM conversations WHERE id = $1 AND user_id = $2", [id, userId]);
      return result.rowCount === 1;
    }, () => {
      ensureSqliteReady();
      return Boolean(sqlite.prepare("SELECT 1 FROM conversations WHERE id = ? AND user_id = ?").get(id, userId));
    });
  },

  async saveMessages(messages: ConversationMessage[]) {
    if (messages.length === 0) return;
    const updatedAt = new Date();
    return withStore(async () => {
      await ensurePostgresReady();
      const client = await getPostgresPool().connect();
      try {
        await client.query("BEGIN");
        for (const message of messages) {
          await client.query(
            `INSERT INTO conversation_messages (id, conversation_id, role, content, attachments, created_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)
             ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, attachments = EXCLUDED.attachments`,
            [message.id, message.conversationId, message.role, message.content, JSON.stringify(message.attachments), message.createdAt],
          );
        }
        await client.query("UPDATE conversations SET updated_at = $1 WHERE id = $2", [updatedAt, messages[0]!.conversationId]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }, () => {
      ensureSqliteReady();
      const insert = sqlite.prepare(`
        INSERT INTO conversation_messages (id, conversation_id, role, content, attachments, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET content = excluded.content, attachments = excluded.attachments
      `);
      sqlite.transaction(() => {
        for (const message of messages) {
          insert.run(message.id, message.conversationId, message.role, message.content, JSON.stringify(message.attachments), message.createdAt.getTime());
        }
        sqlite.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(updatedAt.getTime(), messages[0]!.conversationId);
      })();
    });
  },

  async saveAnswerSources(sources: AnswerSource[]) {
    if (sources.length === 0) return;
    return withStore(async () => {
      await ensurePostgresReady();
      for (const source of sources) {
        await getPostgresPool().query(
          `INSERT INTO answer_sources (message_id, source_id, title, url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (message_id, source_id) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url`,
          [source.messageId, source.sourceId, source.title, source.url],
        );
      }
    }, () => {
      ensureSqliteReady();
      const insert = sqlite.prepare(`
        INSERT INTO answer_sources (message_id, source_id, title, url) VALUES (?, ?, ?, ?)
        ON CONFLICT(message_id, source_id) DO UPDATE SET title = excluded.title, url = excluded.url
      `);
      sqlite.transaction(() => sources.forEach((source) => insert.run(source.messageId, source.sourceId, source.title, source.url)))();
    });
  },

  async recordModelUsage(input: {
    id: string;
    userId: string;
    conversationId: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }) {
    const createdAt = new Date();
    const inputTokens = Math.max(0, Math.floor(input.inputTokens));
    const outputTokens = Math.max(0, Math.floor(input.outputTokens));
    const totalTokens = Math.max(inputTokens + outputTokens, Math.floor(input.totalTokens));
    return withStore(async () => {
      await ensurePostgresReady();
      await getPostgresPool().query(
        `INSERT INTO model_usage (id, user_id, conversation_id, model_id, input_tokens, output_tokens, total_tokens, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [input.id, input.userId, input.conversationId, input.modelId, inputTokens, outputTokens, totalTokens, createdAt],
      );
    }, () => {
      ensureSqliteReady();
      sqlite.prepare(`
        INSERT INTO model_usage (id, user_id, conversation_id, model_id, input_tokens, output_tokens, total_tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(input.id, input.userId, input.conversationId, input.modelId, inputTokens, outputTokens, totalTokens, createdAt.getTime());
    });
  },

  async getModelUsageOverview(limit = 8): Promise<ModelUsageOverview> {
    const normalizedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    return withStore(async () => {
      await ensurePostgresReady();
      const db = getPostgresPool();
      const [totalsResult, modelsResult, usersResult] = await Promise.all([
        db.query<DatabaseRow>(`
          SELECT
            COUNT(*) AS request_count,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
          FROM model_usage
        `),
        db.query<DatabaseRow>(`
          SELECT
            model_id,
            COUNT(*) AS request_count,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
          FROM model_usage
          GROUP BY model_id
          ORDER BY total_tokens DESC, request_count DESC, model_id ASC
          LIMIT $1
        `, [normalizedLimit]),
        db.query<DatabaseRow>(`
          WITH user_questions AS (
            SELECT
              conversations.user_id,
              COUNT(conversation_messages.id) AS question_count,
              MAX(conversation_messages.created_at) AS last_asked_at
            FROM conversation_messages
            INNER JOIN conversations ON conversations.id = conversation_messages.conversation_id
            WHERE conversation_messages.role = 'user'
            GROUP BY conversations.user_id
          ),
          user_tokens AS (
            SELECT
              user_id,
              COUNT(*) AS model_request_count,
              COALESCE(SUM(total_tokens), 0) AS total_tokens
            FROM model_usage
            GROUP BY user_id
          )
          SELECT
            demo_users.id,
            demo_users.display_name,
            user_questions.question_count,
            COALESCE(user_tokens.model_request_count, 0) AS model_request_count,
            COALESCE(user_tokens.total_tokens, 0) AS total_tokens,
            user_questions.last_asked_at
          FROM user_questions
          INNER JOIN demo_users ON demo_users.id = user_questions.user_id
          LEFT JOIN user_tokens ON user_tokens.user_id = user_questions.user_id
          ORDER BY user_questions.question_count DESC, user_questions.last_asked_at DESC
          LIMIT $1
        `, [normalizedLimit]),
      ]);
      const totals = totalsResult.rows[0] ?? {};
      return {
        totalRequests: Number(totals.request_count ?? 0),
        inputTokens: Number(totals.input_tokens ?? 0),
        outputTokens: Number(totals.output_tokens ?? 0),
        totalTokens: Number(totals.total_tokens ?? 0),
        models: modelsResult.rows.map((row) => ({
          modelId: String(row.model_id),
          requestCount: Number(row.request_count ?? 0),
          inputTokens: Number(row.input_tokens ?? 0),
          outputTokens: Number(row.output_tokens ?? 0),
          totalTokens: Number(row.total_tokens ?? 0),
        })),
        users: usersResult.rows.map((row) => ({
          userId: String(row.id),
          displayName: String(row.display_name),
          questionCount: Number(row.question_count ?? 0),
          modelRequestCount: Number(row.model_request_count ?? 0),
          totalTokens: Number(row.total_tokens ?? 0),
          lastAskedAt: date(row.last_asked_at),
        })),
      };
    }, () => {
      ensureSqliteReady();
      const totals = sqlite.prepare(`
        SELECT
          COUNT(*) AS request_count,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(total_tokens), 0) AS total_tokens
        FROM model_usage
      `).get() as DatabaseRow;
      const models = sqlite.prepare(`
        SELECT
          model_id,
          COUNT(*) AS request_count,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(total_tokens), 0) AS total_tokens
        FROM model_usage
        GROUP BY model_id
        ORDER BY total_tokens DESC, request_count DESC, model_id ASC
        LIMIT ?
      `).all(normalizedLimit) as DatabaseRow[];
      const users = sqlite.prepare(`
        WITH user_questions AS (
          SELECT
            conversations.user_id,
            COUNT(conversation_messages.id) AS question_count,
            MAX(conversation_messages.created_at) AS last_asked_at
          FROM conversation_messages
          INNER JOIN conversations ON conversations.id = conversation_messages.conversation_id
          WHERE conversation_messages.role = 'user'
          GROUP BY conversations.user_id
        ),
        user_tokens AS (
          SELECT
            user_id,
            COUNT(*) AS model_request_count,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
          FROM model_usage
          GROUP BY user_id
        )
        SELECT
          demo_users.id,
          demo_users.display_name,
          user_questions.question_count,
          COALESCE(user_tokens.model_request_count, 0) AS model_request_count,
          COALESCE(user_tokens.total_tokens, 0) AS total_tokens,
          user_questions.last_asked_at
        FROM user_questions
        INNER JOIN demo_users ON demo_users.id = user_questions.user_id
        LEFT JOIN user_tokens ON user_tokens.user_id = user_questions.user_id
        ORDER BY user_questions.question_count DESC, user_questions.last_asked_at DESC
        LIMIT ?
      `).all(normalizedLimit) as DatabaseRow[];
      return {
        totalRequests: Number(totals.request_count ?? 0),
        inputTokens: Number(totals.input_tokens ?? 0),
        outputTokens: Number(totals.output_tokens ?? 0),
        totalTokens: Number(totals.total_tokens ?? 0),
        models: models.map((row) => ({
          modelId: String(row.model_id),
          requestCount: Number(row.request_count ?? 0),
          inputTokens: Number(row.input_tokens ?? 0),
          outputTokens: Number(row.output_tokens ?? 0),
          totalTokens: Number(row.total_tokens ?? 0),
        })),
        users: users.map((row) => ({
          userId: String(row.id),
          displayName: String(row.display_name),
          questionCount: Number(row.question_count ?? 0),
          modelRequestCount: Number(row.model_request_count ?? 0),
          totalTokens: Number(row.total_tokens ?? 0),
          lastAskedAt: date(row.last_asked_at),
        })),
      };
    });
  },

  async listUsers(limit = 100) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>("SELECT * FROM demo_users ORDER BY last_seen_at DESC LIMIT $1", [limit]);
      return result.rows.map(mapUser);
    }, () => {
      ensureSqliteReady();
      return (sqlite.prepare("SELECT * FROM demo_users ORDER BY last_seen_at DESC LIMIT ?").all(limit) as DatabaseRow[]).map(mapUser);
    });
  },

  async listConversations(options: { userId?: string; query?: string; limit?: number } = {}) {
    const limit = options.limit ?? 100;
    const query = options.query?.normalize("NFKC").trim().slice(0, 100) ?? "";
    const pattern = `%${query}%`;
    return withStore(async () => {
      await ensurePostgresReady();
      const result = options.userId && query
        ? await getPostgresPool().query<DatabaseRow>(`
          SELECT * FROM conversations
          WHERE user_id = $1 AND (
            title ILIKE $2 OR EXISTS (
              SELECT 1 FROM conversation_messages
              WHERE conversation_messages.conversation_id = conversations.id AND conversation_messages.content ILIKE $2
            )
          )
          ORDER BY updated_at DESC LIMIT $3`, [options.userId, pattern, limit])
        : options.userId
          ? await getPostgresPool().query<DatabaseRow>("SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2", [options.userId, limit])
          : query
            ? await getPostgresPool().query<DatabaseRow>(`
              SELECT * FROM conversations
              WHERE title ILIKE $1 OR EXISTS (
                SELECT 1 FROM conversation_messages
                WHERE conversation_messages.conversation_id = conversations.id AND conversation_messages.content ILIKE $1
              )
              ORDER BY updated_at DESC LIMIT $2`, [pattern, limit])
            : await getPostgresPool().query<DatabaseRow>("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT $1", [limit]);
      return rankConversationSearch(result.rows.map(mapConversation), query);
    }, () => {
      ensureSqliteReady();
      const rows = options.userId && query
        ? sqlite.prepare(`
          SELECT * FROM conversations
          WHERE user_id = ? AND (
            title LIKE ? COLLATE NOCASE OR EXISTS (
              SELECT 1 FROM conversation_messages
              WHERE conversation_messages.conversation_id = conversations.id AND conversation_messages.content LIKE ? COLLATE NOCASE
            )
          )
          ORDER BY updated_at DESC LIMIT ?`).all(options.userId, pattern, pattern, limit)
        : options.userId
          ? sqlite.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?").all(options.userId, limit)
          : query
            ? sqlite.prepare(`
              SELECT * FROM conversations
              WHERE title LIKE ? COLLATE NOCASE OR EXISTS (
                SELECT 1 FROM conversation_messages
                WHERE conversation_messages.conversation_id = conversations.id AND conversation_messages.content LIKE ? COLLATE NOCASE
              )
              ORDER BY updated_at DESC LIMIT ?`).all(pattern, pattern, limit)
            : sqlite.prepare("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?").all(limit);
      return rankConversationSearch((rows as DatabaseRow[]).map(mapConversation), query);
    });
  },

  async getConversation(id: string): Promise<ConversationDetail | null> {
    return withStore(async () => {
      await ensurePostgresReady();
      const conversation = await getPostgresPool().query<DatabaseRow>("SELECT * FROM conversations WHERE id = $1", [id]);
      if (!conversation.rows[0]) return null;
      const messages = await getPostgresPool().query<DatabaseRow>("SELECT * FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at", [id]);
      const sources = await getPostgresPool().query<DatabaseRow>(`
        SELECT answer_sources.* FROM answer_sources
        INNER JOIN conversation_messages ON conversation_messages.id = answer_sources.message_id
        WHERE conversation_messages.conversation_id = $1
      `, [id]);
      const feedback = await getPostgresPool().query<DatabaseRow>(`
        SELECT answer_feedback.* FROM answer_feedback
        INNER JOIN conversation_messages ON conversation_messages.id = answer_feedback.message_id
        WHERE conversation_messages.conversation_id = $1
      `, [id]);
      return {
        conversation: mapConversation(conversation.rows[0]),
        messages: messages.rows.map(mapMessage),
        sources: sources.rows.map((row) => ({ messageId: String(row.message_id), sourceId: String(row.source_id), title: String(row.title), url: String(row.url) })),
        feedback: feedback.rows.map((row) => ({ messageId: String(row.message_id), userId: String(row.user_id), value: row.value as AnswerFeedback["value"], createdAt: date(row.created_at) })),
      };
    }, () => {
      ensureSqliteReady();
      const conversation = sqlite.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as DatabaseRow | undefined;
      if (!conversation) return null;
      const messages = sqlite.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at").all(id) as DatabaseRow[];
      const sources = sqlite.prepare(`
        SELECT answer_sources.* FROM answer_sources
        INNER JOIN conversation_messages ON conversation_messages.id = answer_sources.message_id
        WHERE conversation_messages.conversation_id = ?
      `).all(id) as DatabaseRow[];
      const feedback = sqlite.prepare(`
        SELECT answer_feedback.* FROM answer_feedback
        INNER JOIN conversation_messages ON conversation_messages.id = answer_feedback.message_id
        WHERE conversation_messages.conversation_id = ?
      `).all(id) as DatabaseRow[];
      return {
        conversation: mapConversation(conversation),
        messages: messages.map(mapMessage),
        sources: sources.map((row) => ({ messageId: String(row.message_id), sourceId: String(row.source_id), title: String(row.title), url: String(row.url) })),
        feedback: feedback.map((row) => ({ messageId: String(row.message_id), userId: String(row.user_id), value: row.value as AnswerFeedback["value"], createdAt: date(row.created_at) })),
      };
    });
  },

  async deleteConversation(id: string, userId: string) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query(
        "DELETE FROM conversations WHERE id = $1 AND user_id = $2",
        [id, userId],
      );
      return result.rowCount === 1;
    }, () => {
      ensureSqliteReady();
      return sqlite.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(id, userId).changes === 1;
    });
  },

  async createUploadedFile(file: NewUploadedFile) {
    const now = new Date();
    return withStore(async () => {
      await ensurePostgresReady();
      await getPostgresPool().query(
        `INSERT INTO uploaded_files (id, user_id, conversation_id, original_name, media_type, size_bytes, object_path, kind, status, analysis, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
        [file.id, file.userId, file.conversationId, file.originalName, file.mediaType, file.sizeBytes, file.objectPath, file.kind, file.status, file.analysis ? JSON.stringify(file.analysis) : null, now],
      );
      return { ...file, createdAt: now };
    }, () => {
      ensureSqliteReady();
      sqlite.prepare(`
        INSERT INTO uploaded_files (id, user_id, conversation_id, original_name, media_type, size_bytes, object_path, kind, status, analysis, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(file.id, file.userId, file.conversationId, file.originalName, file.mediaType, file.sizeBytes, file.objectPath, file.kind, file.status, file.analysis ? JSON.stringify(file.analysis) : null, now.getTime());
      return { ...file, createdAt: now };
    });
  },

  async listUploadedFiles(limit = 100) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>("SELECT * FROM uploaded_files ORDER BY created_at DESC LIMIT $1", [limit]);
      return result.rows.map(mapFile);
    }, () => {
      ensureSqliteReady();
      return (sqlite.prepare("SELECT * FROM uploaded_files ORDER BY created_at DESC LIMIT ?").all(limit) as DatabaseRow[]).map(mapFile);
    });
  },

  async listUploadedFilesForUser(userId: string, limit = 100) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>(
        "SELECT * FROM uploaded_files WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [userId, limit],
      );
      return result.rows.map(mapFile);
    }, () => {
      ensureSqliteReady();
      return (sqlite.prepare("SELECT * FROM uploaded_files WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as DatabaseRow[]).map(mapFile);
    });
  },

  async getUploadedFile(id: string) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>("SELECT * FROM uploaded_files WHERE id = $1 LIMIT 1", [id]);
      return result.rows[0] ? mapFile(result.rows[0]) : null;
    }, () => {
      ensureSqliteReady();
      const row = sqlite.prepare("SELECT * FROM uploaded_files WHERE id = ? LIMIT 1").get(id) as DatabaseRow | undefined;
      return row ? mapFile(row) : null;
    });
  },

  async renameUploadedFile(id: string, userId: string, originalName: string): Promise<UploadedFile | null> {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>(
        "UPDATE uploaded_files SET original_name = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [originalName, id, userId],
      );
      return result.rows[0] ? mapFile(result.rows[0]) : null;
    }, () => {
      ensureSqliteReady();
      const result = sqlite.prepare("UPDATE uploaded_files SET original_name = ? WHERE id = ? AND user_id = ?").run(originalName, id, userId);
      if (result.changes !== 1) return null;
      const row = sqlite.prepare("SELECT * FROM uploaded_files WHERE id = ?").get(id) as DatabaseRow | undefined;
      return row ? mapFile(row) : null;
    });
  },

  async deleteUploadedFile(id: string, userId: string) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query(
        "DELETE FROM uploaded_files WHERE id = $1 AND user_id = $2",
        [id, userId],
      );
      return result.rowCount === 1;
    }, () => {
      ensureSqliteReady();
      return sqlite.prepare("DELETE FROM uploaded_files WHERE id = ? AND user_id = ?").run(id, userId).changes === 1;
    });
  },

  async linkUploadedFilesToConversation(ids: string[], userId: string, conversationId: string) {
    if (ids.length === 0) return;
    return withStore(async () => {
      await ensurePostgresReady();
      await getPostgresPool().query(
        "UPDATE uploaded_files SET conversation_id = $1 WHERE id = ANY($2) AND user_id = $3",
        [conversationId, ids, userId],
      );
    }, () => {
      ensureSqliteReady();
      const update = sqlite.prepare("UPDATE uploaded_files SET conversation_id = ? WHERE id = ? AND user_id = ?");
      sqlite.transaction(() => ids.forEach((id) => update.run(conversationId, id, userId)))();
    });
  },

  async getMessageOwner(messageId: string) {
    return withStore(async () => {
      await ensurePostgresReady();
      const result = await getPostgresPool().query<DatabaseRow>(`
        SELECT conversations.user_id, conversation_messages.conversation_id
        FROM conversation_messages
        INNER JOIN conversations ON conversations.id = conversation_messages.conversation_id
        WHERE conversation_messages.id = $1 AND conversation_messages.role = 'assistant'
      `, [messageId]);
      return result.rows[0] ? { userId: String(result.rows[0].user_id), conversationId: String(result.rows[0].conversation_id) } : null;
    }, () => {
      ensureSqliteReady();
      const row = sqlite.prepare(`
        SELECT conversations.user_id, conversation_messages.conversation_id
        FROM conversation_messages
        INNER JOIN conversations ON conversations.id = conversation_messages.conversation_id
        WHERE conversation_messages.id = ? AND conversation_messages.role = 'assistant'
      `).get(messageId) as DatabaseRow | undefined;
      return row ? { userId: String(row.user_id), conversationId: String(row.conversation_id) } : null;
    });
  },

  async saveFeedback(messageId: string, userId: string, value: AnswerFeedback["value"]) {
    const now = new Date();
    return withStore(async () => {
      await ensurePostgresReady();
      await getPostgresPool().query(
        `INSERT INTO answer_feedback (message_id, user_id, value, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = EXCLUDED.created_at`,
        [messageId, userId, value, now],
      );
    }, () => {
      ensureSqliteReady();
      sqlite.prepare(`
        INSERT INTO answer_feedback (message_id, user_id, value, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(message_id, user_id) DO UPDATE SET value = excluded.value, created_at = excluded.created_at
      `).run(messageId, userId, value, now.getTime());
    });
  },
};
