import { Pool, type PoolClient, type QueryResult } from "pg";

import { postgresPoolConfig } from "./postgres-config";
import { seedKnowledge, seedKnowledgeGaps } from "./seed-data";
import type {
  KnowledgeChunk,
  KnowledgeGap,
  KnowledgeItem,
  NewKnowledgeChunk,
  NewKnowledgeGap,
  NewKnowledgeItem,
} from "./schema";
import type { KnowledgeStorage } from "./storage-types";

type DatabaseClient = Pool | PoolClient;
type DatabaseRow = Record<string, unknown>;

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool() {
  if (pool) return pool;
  pool = new Pool(postgresPoolConfig({ max: 10 }));
  return pool;
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") return JSON.parse(value) as T[];
  return [];
}

function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as number[];
}

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function nullableDate(value: unknown) {
  return value == null ? null : asDate(value);
}

function mapKnowledge(row: DatabaseRow): KnowledgeItem {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary),
    content: String(row.content),
    category: String(row.category),
    tags: parseArray<string>(row.tags),
    sourceLabel: String(row.source_label),
    ownerName: String(row.owner_name),
    status: row.status as KnowledgeItem["status"],
    reviewDate: nullableDate(row.review_date),
    approvedBy: row.approved_by == null ? null : String(row.approved_by),
    approvedAt: nullableDate(row.approved_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function mapGap(row: DatabaseRow): KnowledgeGap {
  return {
    id: String(row.id),
    question: String(row.question),
    normalizedQuestion: String(row.normalized_question),
    count: Number(row.count),
    status: row.status as KnowledgeGap["status"],
    firstAskedAt: asDate(row.first_asked_at),
    lastAskedAt: asDate(row.last_asked_at),
    resolvedKnowledgeItemId:
      row.resolved_knowledge_item_id == null
        ? null
        : String(row.resolved_knowledge_item_id),
  };
}

function mapChunk(row: DatabaseRow): KnowledgeChunk {
  return {
    id: String(row.id),
    knowledgeItemId: String(row.knowledge_item_id),
    content: String(row.content),
    chunkIndex: Number(row.chunk_index),
    embedding: parseVector(row.embedding),
    embeddingModel: String(row.embedding_model),
    createdAt: asDate(row.created_at),
  };
}

async function insertKnowledge(client: DatabaseClient, item: NewKnowledgeItem) {
  await client.query(
    `INSERT INTO knowledge_items
      (id, title, summary, content, category, tags, source_label, owner_name,
       status, review_date, approved_by, approved_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      item.id,
      item.title,
      item.summary,
      item.content,
      item.category,
      JSON.stringify(item.tags),
      item.sourceLabel,
      item.ownerName,
      item.status ?? "draft",
      item.reviewDate ?? null,
      item.approvedBy ?? null,
      item.approvedAt ?? null,
      item.createdAt,
      item.updatedAt,
    ],
  );
}

async function insertGap(client: DatabaseClient, gap: NewKnowledgeGap) {
  await client.query(
    `INSERT INTO knowledge_gaps
      (id, question, normalized_question, count, status, first_asked_at,
       last_asked_at, resolved_knowledge_item_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      gap.id,
      gap.question,
      gap.normalizedQuestion,
      gap.count ?? 1,
      gap.status ?? "new",
      gap.firstAskedAt,
      gap.lastAskedAt,
      gap.resolvedKnowledgeItemId ?? null,
    ],
  );
}

async function initialize() {
  const database = getPool();
  await database.query(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id VARCHAR(64) PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(191) NOT NULL,
      tags JSONB NOT NULL,
      source_label TEXT NOT NULL,
      owner_name VARCHAR(191) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      review_date TIMESTAMPTZ NULL,
      approved_by VARCHAR(191) NULL,
      approved_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id VARCHAR(191) PRIMARY KEY,
      knowledge_item_id VARCHAR(64) NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      embedding vector NOT NULL,
      embedding_model VARCHAR(191) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id VARCHAR(64) PRIMARY KEY,
      question TEXT NOT NULL,
      normalized_question VARCHAR(512) NOT NULL UNIQUE,
      count INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(24) NOT NULL DEFAULT 'new',
      first_asked_at TIMESTAMPTZ NOT NULL,
      last_asked_at TIMESTAMPTZ NOT NULL,
      resolved_knowledge_item_id VARCHAR(64) NULL REFERENCES knowledge_items(id) ON DELETE SET NULL
    )
  `);
  await database.query("CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_items(status)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON knowledge_items(updated_at DESC)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_chunks_item ON knowledge_chunks(knowledge_item_id)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_gaps_status ON knowledge_gaps(status)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_gaps_last_asked ON knowledge_gaps(last_asked_at DESC)");

  const dimensions = await database.query<{ dimensions: number }>(
    "SELECT DISTINCT vector_dims(embedding)::int AS dimensions FROM knowledge_chunks LIMIT 2",
  );
  if (dimensions.rows.length === 1) {
    await createVectorIndex(database, dimensions.rows[0]!.dimensions);
  }

  const result = await database.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM knowledge_items",
  );
  if (Number(result.rows[0]?.count ?? 0) === 0) {
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      for (const item of seedKnowledge) await insertKnowledge(client, item);
      for (const gap of seedKnowledgeGaps) await insertGap(client, gap);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function createVectorIndex(database: DatabaseClient, dimensions: number) {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 2_000) return;
  await database.query(
    `CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
     ON knowledge_chunks USING hnsw ((embedding::vector(${dimensions})) vector_cosine_ops)`,
  );
}

async function ensureReady() {
  ready ??= initialize();
  return ready;
}

const knowledgeColumns: Record<string, string> = {
  title: "title",
  summary: "summary",
  content: "content",
  category: "category",
  tags: "tags",
  sourceLabel: "source_label",
  ownerName: "owner_name",
  status: "status",
  reviewDate: "review_date",
  approvedBy: "approved_by",
  approvedAt: "approved_at",
  updatedAt: "updated_at",
};

const gapColumns: Record<string, string> = {
  count: "count",
  status: "status",
  lastAskedAt: "last_asked_at",
  resolvedKnowledgeItemId: "resolved_knowledge_item_id",
};

function updateParts(patch: Record<string, unknown>, columns: Record<string, string>) {
  const entries = Object.entries(patch).filter(
    ([key, value]) => value !== undefined && columns[key],
  );
  return {
    clause: entries.map(([key], index) => `${columns[key]} = $${index + 1}`).join(", "),
    values: entries.map(([key, value]) => key === "tags" ? JSON.stringify(value) : value),
  };
}

function affected(result: QueryResult) {
  return (result.rowCount ?? 0) > 0;
}

export const postgresStorage: KnowledgeStorage = {
  provider: "postgres",
  async listKnowledge() {
    await ensureReady();
    const result = await getPool().query("SELECT * FROM knowledge_items ORDER BY updated_at DESC");
    return result.rows.map(mapKnowledge);
  },
  async listApprovedKnowledge() {
    await ensureReady();
    const result = await getPool().query("SELECT * FROM knowledge_items WHERE status = $1", ["approved"]);
    return result.rows.map(mapKnowledge);
  },
  async getKnowledge(id) {
    await ensureReady();
    const result = await getPool().query("SELECT * FROM knowledge_items WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0] ? mapKnowledge(result.rows[0]) : null;
  },
  async createKnowledge(item) {
    await ensureReady();
    await insertKnowledge(getPool(), item);
  },
  async updateKnowledge(id, patch) {
    await ensureReady();
    const { clause, values } = updateParts(patch, knowledgeColumns);
    if (!clause) return false;
    return affected(await getPool().query(
      `UPDATE knowledge_items SET ${clause} WHERE id = $${values.length + 1}`,
      [...values, id],
    ));
  },
  async listChunks() {
    await ensureReady();
    const result = await getPool().query("SELECT *, embedding::text AS embedding FROM knowledge_chunks");
    return result.rows.map(mapChunk);
  },
  async replaceChunks(chunks: NewKnowledgeChunk[]) {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DROP INDEX IF EXISTS idx_chunks_embedding_hnsw");
      await client.query("DELETE FROM knowledge_chunks");
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO knowledge_chunks
            (id, knowledge_item_id, content, chunk_index, embedding, embedding_model, created_at)
           VALUES ($1, $2, $3, $4, $5::vector, $6, $7)`,
          [
            chunk.id,
            chunk.knowledgeItemId,
            chunk.content,
            chunk.chunkIndex,
            JSON.stringify(chunk.embedding),
            chunk.embeddingModel,
            chunk.createdAt,
          ],
        );
      }
      const dimensions = chunks[0]?.embedding.length ?? 0;
      if (chunks.some((chunk) => chunk.embedding.length !== dimensions)) {
        throw new Error("Knowledge embeddings must use one dimension per index build");
      }
      await createVectorIndex(client, dimensions);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async listGaps() {
    await ensureReady();
    const result = await getPool().query("SELECT * FROM knowledge_gaps ORDER BY last_asked_at DESC");
    return result.rows.map(mapGap);
  },
  async getGap(id) {
    await ensureReady();
    const result = await getPool().query("SELECT * FROM knowledge_gaps WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0] ? mapGap(result.rows[0]) : null;
  },
  async findGapByNormalizedQuestion(normalized) {
    await ensureReady();
    const result = await getPool().query(
      "SELECT * FROM knowledge_gaps WHERE normalized_question = $1 LIMIT 1",
      [normalized],
    );
    return result.rows[0] ? mapGap(result.rows[0]) : null;
  },
  async createGap(gap) {
    await ensureReady();
    await insertGap(getPool(), gap);
  },
  async updateGap(id, patch) {
    await ensureReady();
    const { clause, values } = updateParts(patch, gapColumns);
    if (!clause) return false;
    return affected(await getPool().query(
      `UPDATE knowledge_gaps SET ${clause} WHERE id = $${values.length + 1}`,
      [...values, id],
    ));
  },
  async resolveGapsForKnowledge(knowledgeId) {
    await ensureReady();
    await getPool().query(
      "UPDATE knowledge_gaps SET status = 'resolved' WHERE resolved_knowledge_item_id = $1",
      [knowledgeId],
    );
  },
  async convertGapToDraft(id) {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT * FROM knowledge_gaps WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      const gap = mapGap(result.rows[0]);
      if (gap.resolvedKnowledgeItemId) {
        await client.query("COMMIT");
        return gap.resolvedKnowledgeItemId;
      }
      const knowledgeId = crypto.randomUUID();
      const now = new Date();
      await insertKnowledge(client, {
        id: knowledgeId,
        title: gap.question,
        summary: "คำถามที่ส่งต่อจาก Knowledge Gap",
        content: "กรุณาเพิ่มคำตอบที่ผ่านการตรวจสอบก่อนอนุมัติ",
        category: "รอจัดหมวดหมู่",
        tags: ["knowledge-gap"],
        sourceLabel: "คำตอบจากหัวหน้าทีม",
        ownerName: "Team Leader",
        status: "draft",
        reviewDate: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await client.query(
        "UPDATE knowledge_gaps SET status = 'escalated', resolved_knowledge_item_id = $1 WHERE id = $2",
        [knowledgeId, id],
      );
      await client.query("COMMIT");
      return knowledgeId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async resetDemoData() {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM knowledge_chunks");
      await client.query("DELETE FROM knowledge_gaps");
      await client.query("DELETE FROM knowledge_items");
      for (const item of seedKnowledge) await insertKnowledge(client, item);
      for (const gap of seedKnowledgeGaps) await insertGap(client, gap);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export async function searchPostgresChunks(
  queryEmbedding: number[],
  embeddingModel: string,
  limit = 80,
) {
  await ensureReady();
  const dimensions = queryEmbedding.length;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 2_000) {
    return postgresStorage.listChunks();
  }
  const normalizedLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
  const result = await getPool().query(
    `SELECT *, embedding::text AS embedding
     FROM knowledge_chunks
     WHERE embedding_model = $2 AND vector_dims(embedding) = $3
     ORDER BY embedding::vector(${dimensions}) <=> $1::vector(${dimensions})
     LIMIT $4`,
    [JSON.stringify(queryEmbedding), embeddingModel, dimensions, normalizedLimit],
  );
  return result.rows.map(mapChunk);
}
