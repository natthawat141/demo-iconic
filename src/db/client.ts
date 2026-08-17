import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { count } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import path from "node:path";

import * as schema from "./schema";
import { seedKnowledge } from "./seed-data";

const dataDirectory = path.join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const sqlite = new Database(
  process.env.DEMO_DB_PATH ?? path.join(dataDirectory, "demo.sqlite"),
);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL,
    source_label TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    review_date INTEGER,
    approved_by TEXT,
    approved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    knowledge_item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    normalized_question TEXT NOT NULL UNIQUE,
    count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'new',
    first_asked_at INTEGER NOT NULL,
    last_asked_at INTEGER NOT NULL,
    resolved_knowledge_item_id TEXT REFERENCES knowledge_items(id)
  );

`);

export const db = drizzle(sqlite, { schema });

export function ensureSeeded() {
  const [{ value }] = db
    .select({ value: count() })
    .from(schema.knowledgeItems)
    .all();
  if (value === 0) {
    db.insert(schema.knowledgeItems).values(seedKnowledge).run();
  }
}

export function resetDemoData() {
  db.delete(schema.knowledgeChunks).run();
  db.delete(schema.knowledgeGaps).run();
  db.delete(schema.knowledgeItems).run();
  db.insert(schema.knowledgeItems).values(seedKnowledge).run();
}

ensureSeeded();
