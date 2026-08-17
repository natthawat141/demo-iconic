import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { knowledgeGaps, knowledgeItems } from "@/db/schema";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const gap = db
    .select()
    .from(knowledgeGaps)
    .where(eq(knowledgeGaps.id, id))
    .get();
  if (!gap) return Response.json({ error: "ไม่พบ Knowledge Gap" }, { status: 404 });

  if (gap.resolvedKnowledgeItemId) {
    return Response.json({ knowledgeId: gap.resolvedKnowledgeItemId });
  }

  const knowledgeId = crypto.randomUUID();
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(knowledgeItems)
      .values({
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
      })
      .run();
    tx.update(knowledgeGaps)
      .set({
        status: "escalated",
        resolvedKnowledgeItemId: knowledgeId,
      })
      .where(eq(knowledgeGaps.id, id))
      .run();
  });

  return Response.json({ knowledgeId }, { status: 201 });
}
