import { storage } from "@/db/storage";
import { rebuildKnowledgeIndex } from "@/lib/knowledge";

export async function POST() {
  await storage.resetDemoData();
  await rebuildKnowledgeIndex(true);
  return Response.json({ ok: true });
}
