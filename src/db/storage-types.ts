import type {
  KnowledgeChunk,
  KnowledgeGap,
  KnowledgeItem,
  NewKnowledgeChunk,
  NewKnowledgeGap,
  NewKnowledgeItem,
} from "./schema";

export type KnowledgeUpdate = Partial<
  Omit<NewKnowledgeItem, "id" | "createdAt">
>;

export type GapUpdate = Partial<
  Pick<KnowledgeGap, "count" | "status" | "lastAskedAt" | "resolvedKnowledgeItemId">
>;

export interface KnowledgeStorage {
  readonly provider: "sqlite" | "mysql" | "postgres";
  listKnowledge(): Promise<KnowledgeItem[]>;
  listApprovedKnowledge(): Promise<KnowledgeItem[]>;
  getKnowledge(id: string): Promise<KnowledgeItem | null>;
  createKnowledge(item: NewKnowledgeItem): Promise<void>;
  updateKnowledge(id: string, patch: KnowledgeUpdate): Promise<boolean>;
  listChunks(): Promise<KnowledgeChunk[]>;
  replaceChunks(chunks: NewKnowledgeChunk[]): Promise<void>;
  listGaps(): Promise<KnowledgeGap[]>;
  getGap(id: string): Promise<KnowledgeGap | null>;
  findGapByNormalizedQuestion(normalized: string): Promise<KnowledgeGap | null>;
  createGap(gap: NewKnowledgeGap): Promise<void>;
  updateGap(id: string, patch: GapUpdate): Promise<boolean>;
  resolveGapsForKnowledge(knowledgeId: string): Promise<void>;
  convertGapToDraft(id: string): Promise<string | null>;
  resetDemoData(): Promise<void>;
}
