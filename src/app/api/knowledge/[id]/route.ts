import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { knowledgeItems } from "@/db/schema";
import { rebuildKnowledgeIndex } from "@/lib/knowledge";
import { knowledgePatchSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const item = db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, id))
    .get();
  if (!item) return Response.json({ error: "ไม่พบ Knowledge" }, { status: 404 });
  return Response.json({ item });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, id))
    .get();
  if (!existing) return Response.json({ error: "ไม่พบ Knowledge" }, { status: 404 });

  const parsed = knowledgePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "ข้อมูลไม่ถูกต้อง", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { reviewDate, ...fields } = parsed.data;
  db.update(knowledgeItems)
    .set({
      ...fields,
      ...(reviewDate !== undefined
        ? {
            reviewDate: reviewDate ? new Date(reviewDate) : null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeItems.id, id))
    .run();

  if (existing.status === "approved") await rebuildKnowledgeIndex(true);
  return Response.json({ ok: true });
}
