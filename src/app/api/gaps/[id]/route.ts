import { z } from "zod";

import { storage } from "@/db/storage";

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
  const updated = await storage.updateGap(id, { status: parsed.data.status });
  if (!updated) {
    return Response.json({ error: "ไม่พบ Knowledge Gap" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
