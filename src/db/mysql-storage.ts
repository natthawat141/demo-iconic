import {
  createPool,
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

import { seedKnowledge, seedKnowledgeGaps } from "./seed-data";
import type {
  KnowledgeChunk,
  KnowledgeGap,
  KnowledgeItem,
  NewKnowledgeChunk,
  NewKnowledgeGap,
  NewKnowledgeItem,
} from "./schema";
import type { GapUpdate, KnowledgeStorage, KnowledgeUpdate } from "./storage-types";

type KnowledgeRow = RowDataPacket & Record<string, unknown>;
type GapRow = RowDataPacket & Record<string, unknown>;
type ChunkRow = RowDataPacket & Record<string, unknown>;

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.MYSQL_URL?.trim();
  if (!url) throw new Error("MYSQL_URL is not configured");
  pool = createPool(url);
  return pool;
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") return JSON.parse(value) as T[];
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8")) as T[];
  return [];
}

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function nullableDate(value: unknown) {
  return value == null ? null : asDate(value);
}

function mapKnowledge(row: KnowledgeRow): KnowledgeItem {
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

function mapGap(row: GapRow): KnowledgeGap {
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

function mapChunk(row: ChunkRow): KnowledgeChunk {
  return {
    id: String(row.id),
    knowledgeItemId: String(row.knowledge_item_id),
    content: String(row.content),
    chunkIndex: Number(row.chunk_index),
    embedding: parseArray<number>(row.embedding),
    embeddingModel: String(row.embedding_model),
    createdAt: asDate(row.created_at),
  };
}

async function insertKnowledge(
  connection: Pool | PoolConnection,
  item: NewKnowledgeItem,
) {
  await connection.execute(
    `INSERT INTO knowledge_items
      (id, title, summary, content, category, tags, source_label, owner_name,
       status, review_date, approved_by, approved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

async function insertGap(connection: Pool | PoolConnection, gap: NewKnowledgeGap) {
  await connection.execute(
    `INSERT INTO knowledge_gaps
      (id, question, normalized_question, count, status, first_asked_at,
       last_asked_at, resolved_knowledge_item_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      content LONGTEXT NOT NULL,
      category VARCHAR(191) NOT NULL,
      tags JSON NOT NULL,
      source_label TEXT NOT NULL,
      owner_name VARCHAR(191) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      review_date DATETIME(3) NULL,
      approved_by VARCHAR(191) NULL,
      approved_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_knowledge_status (status),
      INDEX idx_knowledge_updated (updated_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id VARCHAR(191) PRIMARY KEY,
      knowledge_item_id VARCHAR(64) NOT NULL,
      content LONGTEXT NOT NULL,
      chunk_index INT NOT NULL,
      embedding JSON NOT NULL,
      embedding_model VARCHAR(191) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      INDEX idx_chunks_item (knowledge_item_id),
      CONSTRAINT fk_chunks_knowledge FOREIGN KEY (knowledge_item_id)
        REFERENCES knowledge_items(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id VARCHAR(64) PRIMARY KEY,
      question TEXT NOT NULL,
      normalized_question VARCHAR(512) NOT NULL UNIQUE,
      count INT NOT NULL DEFAULT 1,
      status VARCHAR(24) NOT NULL DEFAULT 'new',
      first_asked_at DATETIME(3) NOT NULL,
      last_asked_at DATETIME(3) NOT NULL,
      resolved_knowledge_item_id VARCHAR(64) NULL,
      INDEX idx_gaps_status (status),
      INDEX idx_gaps_last_asked (last_asked_at),
      CONSTRAINT fk_gaps_knowledge FOREIGN KEY (resolved_knowledge_item_id)
        REFERENCES knowledge_items(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  const [rows] = await database.query<(RowDataPacket & { count: number })[]>(
    "SELECT COUNT(*) AS count FROM knowledge_items",
  );
  if (Number(rows[0]?.count ?? 0) === 0) {
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of seedKnowledge) await insertKnowledge(connection, item);
      for (const gap of seedKnowledgeGaps) await insertGap(connection, gap);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
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

function updateParts(
  patch: Record<string, unknown>,
  columns: Record<string, string>,
): { clause: string; values: Array<string | number | Date | null> } {
  const entries = Object.entries(patch).filter(
    ([key, value]) => value !== undefined && columns[key],
  );
  return {
    clause: entries.map(([key]) => `${columns[key]} = ?`).join(", "),
    values: entries.map(([key, value]) => {
      if (key === "tags") return JSON.stringify(value);
      return value as string | number | Date | null;
    }),
  };
}

export const mysqlStorage: KnowledgeStorage = {
  provider: "mysql",
  async listKnowledge() {
    await ensureReady();
    const [rows] = await getPool().query<KnowledgeRow[]>(
      "SELECT * FROM knowledge_items ORDER BY updated_at DESC",
    );
    return rows.map(mapKnowledge);
  },
  async listApprovedKnowledge() {
    await ensureReady();
    const [rows] = await getPool().execute<KnowledgeRow[]>(
      "SELECT * FROM knowledge_items WHERE status = ?",
      ["approved"],
    );
    return rows.map(mapKnowledge);
  },
  async getKnowledge(id) {
    await ensureReady();
    const [rows] = await getPool().execute<KnowledgeRow[]>(
      "SELECT * FROM knowledge_items WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ? mapKnowledge(rows[0]) : null;
  },
  async createKnowledge(item) {
    await ensureReady();
    await insertKnowledge(getPool(), item);
  },
  async updateKnowledge(id, patch: KnowledgeUpdate) {
    await ensureReady();
    const { clause, values } = updateParts(patch, knowledgeColumns);
    if (!clause) return false;
    const [result] = await getPool().execute<ResultSetHeader>(
      `UPDATE knowledge_items SET ${clause} WHERE id = ?`,
      [...values, id],
    );
    return result.affectedRows > 0;
  },
  async listChunks() {
    await ensureReady();
    const [rows] = await getPool().query<ChunkRow[]>("SELECT * FROM knowledge_chunks");
    return rows.map(mapChunk);
  },
  async replaceChunks(chunks: NewKnowledgeChunk[]) {
    await ensureReady();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM knowledge_chunks");
      for (const chunk of chunks) {
        await connection.execute(
          `INSERT INTO knowledge_chunks
            (id, knowledge_item_id, content, chunk_index, embedding, embedding_model, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  async listGaps() {
    await ensureReady();
    const [rows] = await getPool().query<GapRow[]>(
      "SELECT * FROM knowledge_gaps ORDER BY last_asked_at DESC",
    );
    return rows.map(mapGap);
  },
  async getGap(id) {
    await ensureReady();
    const [rows] = await getPool().execute<GapRow[]>(
      "SELECT * FROM knowledge_gaps WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ? mapGap(rows[0]) : null;
  },
  async findGapByNormalizedQuestion(normalized) {
    await ensureReady();
    const [rows] = await getPool().execute<GapRow[]>(
      "SELECT * FROM knowledge_gaps WHERE normalized_question = ? LIMIT 1",
      [normalized],
    );
    return rows[0] ? mapGap(rows[0]) : null;
  },
  async createGap(gap) {
    await ensureReady();
    await insertGap(getPool(), gap);
  },
  async updateGap(id, patch: GapUpdate) {
    await ensureReady();
    const { clause, values } = updateParts(patch, gapColumns);
    if (!clause) return false;
    const [result] = await getPool().execute<ResultSetHeader>(
      `UPDATE knowledge_gaps SET ${clause} WHERE id = ?`,
      [...values, id],
    );
    return result.affectedRows > 0;
  },
  async resolveGapsForKnowledge(knowledgeId) {
    await ensureReady();
    await getPool().execute(
      "UPDATE knowledge_gaps SET status = 'resolved' WHERE resolved_knowledge_item_id = ?",
      [knowledgeId],
    );
  },
  async convertGapToDraft(id) {
    await ensureReady();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<GapRow[]>(
        "SELECT * FROM knowledge_gaps WHERE id = ? FOR UPDATE",
        [id],
      );
      if (!rows[0]) {
        await connection.rollback();
        return null;
      }
      const gap = mapGap(rows[0]);
      if (gap.resolvedKnowledgeItemId) {
        await connection.commit();
        return gap.resolvedKnowledgeItemId;
      }
      const knowledgeId = crypto.randomUUID();
      const now = new Date();
      await insertKnowledge(connection, {
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
      await connection.execute(
        "UPDATE knowledge_gaps SET status = 'escalated', resolved_knowledge_item_id = ? WHERE id = ?",
        [knowledgeId, id],
      );
      await connection.commit();
      return knowledgeId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  async resetDemoData() {
    await ensureReady();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM knowledge_chunks");
      await connection.query("DELETE FROM knowledge_gaps");
      await connection.query("DELETE FROM knowledge_items");
      for (const item of seedKnowledge) await insertKnowledge(connection, item);
      for (const gap of seedKnowledgeGaps) await insertGap(connection, gap);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};
