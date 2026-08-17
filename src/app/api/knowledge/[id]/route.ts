import { storage } from "@/db/storage";
import { rebuildKnowledgeIndex } from "@/lib/knowledge";
import { knowledgePatchSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const item = await storage.getKnowledge(id);
  if (!item) return Response.json({ error: "ไม่พบ Knowledge" }, { status: 404 });
  return Response.json({ item });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = await storage.getKnowledge(id);
  if (!existing) return Response.json({ error: "ไม่พบ Knowledge" }, { status: 404 });

  const parsed = knowledgePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "ข้อมูลไม่ถูกต้อง", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { reviewDate, ...fields } = parsed.data;
  await storage.updateKnowledge(id, {
    ...fields,
    ...(reviewDate !== undefined
      ? { reviewDate: reviewDate ? new Date(reviewDate) : null }
      : {}),
    updatedAt: new Date(),
  });

  if (existing.status === "approved") await rebuildKnowledgeIndex(true);
  return Response.json({ ok: true });
}
