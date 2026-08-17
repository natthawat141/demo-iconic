import { desc, eq } from "drizzle-orm";

import { db, resetDemoData as resetSqliteDemoData } from "./client";
import {
  knowledgeChunks,
  knowledgeGaps,
  knowledgeItems,
  type NewKnowledgeChunk,
  type NewKnowledgeGap,
  type NewKnowledgeItem,
} from "./schema";
import type { GapUpdate, KnowledgeStorage, KnowledgeUpdate } from "./storage-types";

export const sqliteStorage: KnowledgeStorage = {
  provider: "sqlite",
  async listKnowledge() {
    return db.select().from(knowledgeItems).orderBy(desc(knowledgeItems.updatedAt)).all();
  },
  async listApprovedKnowledge() {
    return db.select().from(knowledgeItems).where(eq(knowledgeItems.status, "approved")).all();
  },
  async getKnowledge(id) {
    return db.select().from(knowledgeItems).where(eq(knowledgeItems.id, id)).get() ?? null;
  },
  async createKnowledge(item: NewKnowledgeItem) {
    db.insert(knowledgeItems).values(item).run();
  },
  async updateKnowledge(id: string, patch: KnowledgeUpdate) {
    return db.update(knowledgeItems).set(patch).where(eq(knowledgeItems.id, id)).run().changes > 0;
  },
  async listChunks() {
    return db.select().from(knowledgeChunks).all();
  },
  async replaceChunks(chunks: NewKnowledgeChunk[]) {
    db.transaction((tx) => {
      tx.delete(knowledgeChunks).run();
      if (chunks.length > 0) tx.insert(knowledgeChunks).values(chunks).run();
    });
  },
  async listGaps() {
    return db.select().from(knowledgeGaps).orderBy(desc(knowledgeGaps.lastAskedAt)).all();
  },
  async getGap(id) {
    return db.select().from(knowledgeGaps).where(eq(knowledgeGaps.id, id)).get() ?? null;
  },
  async findGapByNormalizedQuestion(normalized) {
    return db.select().from(knowledgeGaps).where(eq(knowledgeGaps.normalizedQuestion, normalized)).get() ?? null;
  },
  async createGap(gap: NewKnowledgeGap) {
    db.insert(knowledgeGaps).values(gap).run();
  },
  async updateGap(id: string, patch: GapUpdate) {
    return db.update(knowledgeGaps).set(patch).where(eq(knowledgeGaps.id, id)).run().changes > 0;
  },
  async resolveGapsForKnowledge(knowledgeId) {
    db.update(knowledgeGaps)
      .set({ status: "resolved" })
      .where(eq(knowledgeGaps.resolvedKnowledgeItemId, knowledgeId))
      .run();
  },
  async convertGapToDraft(id) {
    const gap = db.select().from(knowledgeGaps).where(eq(knowledgeGaps.id, id)).get();
    if (!gap) return null;
    if (gap.resolvedKnowledgeItemId) return gap.resolvedKnowledgeItemId;
    const knowledgeId = crypto.randomUUID();
    const now = new Date();
    db.transaction((tx) => {
      tx.insert(knowledgeItems).values({
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
      }).run();
      tx.update(knowledgeGaps)
        .set({ status: "escalated", resolvedKnowledgeItemId: knowledgeId })
        .where(eq(knowledgeGaps.id, id))
        .run();
    });
    return knowledgeId;
  },
  async resetDemoData() {
    resetSqliteDemoData();
  },
};
