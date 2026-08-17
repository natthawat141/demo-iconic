import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { KnowledgeForm } from "@/components/knowledge-form";
import { db } from "@/db/client";
import { knowledgeItems } from "@/db/schema";
import { serializeKnowledge } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = db.select().from(knowledgeItems).where(eq(knowledgeItems.id, id)).get();
  if (!item) notFound();
  return <KnowledgeForm item={serializeKnowledge(item)} />;
}
