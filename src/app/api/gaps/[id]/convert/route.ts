import { storage } from "@/db/storage";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const gap = await storage.getGap(id);
  if (!gap) return Response.json({ error: "ไม่พบ Knowledge Gap" }, { status: 404 });

  if (gap.resolvedKnowledgeItemId) {
    return Response.json({ knowledgeId: gap.resolvedKnowledgeItemId });
  }

  const knowledgeId = await storage.convertGapToDraft(id);
  if (!knowledgeId) return Response.json({ error: "ไม่พบ Knowledge Gap" }, { status: 404 });

  return Response.json({ knowledgeId }, { status: 201 });
}
