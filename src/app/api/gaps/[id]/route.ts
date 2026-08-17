import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { knowledgeGaps } from "@/db/schema";

const gapStatusSchema = z.object({
  status: z.enum(["new", "escalated", "resolved", "dismissed"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = gapStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }
  const result = db
    .update(knowledgeGaps)
    .set({ status: parsed.data.status })
    .where(eq(knowledgeGaps.id, id))
    .run();
  if (result.changes === 0) {
    return Response.json({ error: "ไม่พบ Knowledge Gap" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
