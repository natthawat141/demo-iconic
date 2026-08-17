import { notFound } from "next/navigation";

import { KnowledgeForm } from "@/components/knowledge-form";
import { storage } from "@/db/storage";
import { serializeKnowledge } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await storage.getKnowledge(id);
  if (!item) notFound();
  return <KnowledgeForm item={serializeKnowledge(item)} />;
}
