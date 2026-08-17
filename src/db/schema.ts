import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  sourceLabel: text("source_label").notNull(),
  ownerName: text("owner_name").notNull(),
  status: text("status", { enum: ["draft", "approved", "archived"] })
    .notNull()
    .default("draft"),
  reviewDate: integer("review_date", { mode: "timestamp_ms" }),
  approvedBy: text("approved_by"),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const knowledgeChunks = sqliteTable("knowledge_chunks", {
  id: text("id").primaryKey(),
  knowledgeItemId: text("knowledge_item_id")
    .notNull()
    .references(() => knowledgeItems.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: text("embedding", { mode: "json" }).$type<number[]>().notNull(),
  embeddingModel: text("embedding_model").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const knowledgeGaps = sqliteTable("knowledge_gaps", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  normalizedQuestion: text("normalized_question").notNull().unique(),
  count: integer("count").notNull().default(1),
  status: text("status", {
    enum: ["new", "escalated", "resolved", "dismissed"],
  })
    .notNull()
    .default("new"),
  firstAskedAt: integer("first_asked_at", { mode: "timestamp_ms" }).notNull(),
  lastAskedAt: integer("last_asked_at", { mode: "timestamp_ms" }).notNull(),
  resolvedKnowledgeItemId: text("resolved_knowledge_item_id").references(
    () => knowledgeItems.id,
  ),
});

export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type NewKnowledgeItem = typeof knowledgeItems.$inferInsert;
export type KnowledgeGap = typeof knowledgeGaps.$inferSelect;
