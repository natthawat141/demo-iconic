import { z } from "zod";

import { storage } from "@/db/storage";
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

  const item = await storage.getKnowledge(id);
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
  await storage.updateKnowledge(id, {
    status,
    updatedAt: now,
    approvedBy: status === "approved" ? "Demo Knowledge Manager" : item.approvedBy,
    approvedAt: status === "approved" ? now : item.approvedAt,
  });

  if (status === "approved") {
    await storage.resolveGapsForKnowledge(id);
  }
  await rebuildKnowledgeIndex(true);
  return Response.json({ ok: true, status });
}
