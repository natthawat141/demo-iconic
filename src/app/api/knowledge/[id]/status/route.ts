import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { knowledgeGaps, knowledgeItems } from "@/db/schema";
import { rebuildKnowledgeIndex } from "@/lib/knowledge";
import { knowledgeInputSchema } from "@/lib/validation";

const statusSchema = z.object({
  status: z.enum(["draft", "approved", "archived"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const statusResult = statusSchema.safeParse(await request.json());
  if (!statusResult.success) {
    return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }

  const item = db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, id))
    .get();
  if (!item) return Response.json({ error: "ไม่พบ Knowledge" }, { status: 404 });

  const { status } = statusResult.data;
  if (status === "approved") {
    const complete = knowledgeInputSchema.safeParse({
      ...item,
      reviewDate: item.reviewDate?.toISOString() ?? null,
    });
    if (!complete.success) {
      return Response.json(
        {
          error: "ยังอนุมัติไม่ได้ กรุณากรอกข้อมูลที่จำเป็นให้ครบ",
          fields: complete.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
  }

  const now = new Date();
  db.update(knowledgeItems)
    .set({
      status,
      updatedAt: now,
      approvedBy: status === "approved" ? "Demo Knowledge Manager" : item.approvedBy,
      approvedAt: status === "approved" ? now : item.approvedAt,
    })
    .where(eq(knowledgeItems.id, id))
    .run();

  if (status === "approved") {
    db.update(knowledgeGaps)
      .set({ status: "resolved" })
      .where(eq(knowledgeGaps.resolvedKnowledgeItemId, id))
      .run();
  }
  await rebuildKnowledgeIndex(true);
  return Response.json({ ok: true, status });
}
