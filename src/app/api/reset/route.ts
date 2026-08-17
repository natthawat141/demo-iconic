import { resetDemoData } from "@/db/client";
import { rebuildKnowledgeIndex } from "@/lib/knowledge";

export async function POST() {
  resetDemoData();
  await rebuildKnowledgeIndex(true);
  return Response.json({ ok: true });
}

