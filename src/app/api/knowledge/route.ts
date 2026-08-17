import { desc } from "drizzle-orm";

import { db } from "@/db/client";
import { knowledgeItems } from "@/db/schema";
import { knowledgeInputSchema } from "@/lib/validation";

export async function GET() {
  const items = db
    .select()
    .from(knowledgeItems)
    .orderBy(desc(knowledgeItems.updatedAt))
    .all();
  return Response.json({ items });
}

export async function POST(request: Request) {
  const parsed = knowledgeInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "ข้อมูล Knowledge ยังไม่ครบ", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const now = new Date();
  const id = crypto.randomUUID();
  db.insert(knowledgeItems)
    .values({
      id,
      ...parsed.data,
      reviewDate: parsed.data.reviewDate
        ? new Date(parsed.data.reviewDate)
        : null,
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return Response.json({ id }, { status: 201 });
}
