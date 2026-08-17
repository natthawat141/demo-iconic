import type { KnowledgeGap, KnowledgeItem } from "@/db/schema";
import type { KnowledgeGapDto, KnowledgeItemDto } from "./demo-types";

export function serializeKnowledge(item: KnowledgeItem): KnowledgeItemDto {
  return {
    ...item,
    reviewDate: item.reviewDate?.toISOString() ?? null,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeGap(item: KnowledgeGap): KnowledgeGapDto {
  return {
    id: item.id,
    question: item.question,
    count: item.count,
    status: item.status,
    firstAskedAt: item.firstAskedAt.toISOString(),
    lastAskedAt: item.lastAskedAt.toISOString(),
    resolvedKnowledgeItemId: item.resolvedKnowledgeItemId,
  };
}
