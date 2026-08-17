import { desc } from "drizzle-orm";

import { db } from "@/db/client";
import { knowledgeGaps } from "@/db/schema";

export async function GET() {
  const gaps = db
    .select()
    .from(knowledgeGaps)
    .orderBy(desc(knowledgeGaps.lastAskedAt))
    .all();
  return Response.json({ gaps });
}

