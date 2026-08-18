import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed, embedMany } from "ai";

import type { KnowledgeItem } from "@/db/schema";
import { searchPostgresChunks } from "@/db/postgres-storage";
import { storage } from "@/db/storage";

const LOCAL_MODEL = "local-hash-v1";
const VECTOR_SIZE = 256;

export type RetrievedKnowledge = {
  item: KnowledgeItem;
  excerpt: string;
  score: number;
};

export type KnowledgeSearchResult = {
  matches: RetrievedKnowledge[];
  related: RetrievedKnowledge[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("th")
    // Thai vowels and tone marks are Unicode marks, not letters.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function localEmbedding(value: string) {
  const normalized = normalizeText(value);
  const compact = normalized.replace(/\s/g, "");
  const tokens = normalized.split(" ").filter(Boolean);
  for (let index = 0; index < compact.length - 2; index += 1) {
    tokens.push(compact.slice(index, index + 3));
  }

  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  for (const token of tokens) {
    vector[hashToken(token) % VECTOR_SIZE] += token.length > 2 ? 1 : 0.4;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, part) => sum + part * part, 0));
  return magnitude === 0 ? vector : vector.map((part) => part / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) return 0;
  let score = 0;
  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

function characterNgrams(value: string, size: number) {
  const compact = normalizeText(value).replace(/\s/g, "");
  if (!compact) return new Set<string>();
  if (compact.length <= size) return new Set([compact]);
  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.add(compact.slice(index, index + size));
  }
  return grams;
}

function diceSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return (2 * intersection) / (left.size + right.size);
}

export function lexicalSimilarity(
  question: string,
  item: KnowledgeItem,
  excerpt: string,
) {
  const query = normalizeText(question);
  const fields = [
    item.title,
    item.summary,
    item.category,
    item.tags.join(" "),
    excerpt,
  ];
  const queryBigrams = characterNgrams(query, 2);
  const queryTrigrams = characterNgrams(query, 3);
  const ngramScore = Math.max(
    ...fields.map((field) =>
      0.4 * diceSimilarity(queryBigrams, characterNgrams(field, 2)) +
      0.6 * diceSimilarity(queryTrigrams, characterNgrams(field, 3)),
    ),
  );
  const terms = query.split(" ").filter((term) => term.length > 1);
  const searchable = normalizeText(fields.join(" "));
  const coverage = terms.length === 0
    ? 0
    : terms.filter((term) => searchable.includes(term)).length / terms.length;

  return Math.min(ngramScore * 0.75 + coverage * 0.25, 1);
}

export function chunkKnowledge(item: KnowledgeItem) {
  const header = `${item.title}\n${item.summary}\nหมวดหมู่: ${item.category}\nแท็ก: ${item.tags.join(", ")}`;
  const paragraphs = item.content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = header;
  for (const paragraph of paragraphs) {
    if (`${current}\n${paragraph}`.length > 850 && current !== header) {
      chunks.push(current);
      current = `${header}\n${paragraph}`;
    } else {
      current = `${current}\n${paragraph}`;
    }
  }
  chunks.push(current);
  return chunks;
}

function requestedModelKey() {
  return process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_EMBEDDING_MODEL
    ? `openrouter:${process.env.OPENROUTER_EMBEDDING_MODEL}`
    : LOCAL_MODEL;
}

async function createEmbeddings(values: string[], modelKey: string) {
  if (modelKey === LOCAL_MODEL) {
    return { vectors: values.map(localEmbedding), modelKey };
  }

  try {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!.trim(),
    });
    const { embeddings } = await embedMany({
      model: openrouter.textEmbeddingModel(
        process.env.OPENROUTER_EMBEDDING_MODEL!,
      ),
      values,
    });
    return { vectors: embeddings, modelKey };
  } catch (error) {
    console.error("OpenRouter embedding failed; using demo fallback.", error);
    return { vectors: values.map(localEmbedding), modelKey: LOCAL_MODEL };
  }
}

/** Reusable semantic embedding with the same provider/fallback as Knowledge. */
export async function createSemanticEmbedding(value: string) {
  const { vectors, modelKey } = await createEmbeddings([value], requestedModelKey());
  return { vector: vectors[0] ?? localEmbedding(value), modelKey };
}

export async function rebuildKnowledgeIndex(force = false) {
  const approvedItems = await storage.listApprovedKnowledge();
  const existing = await storage.listChunks();
  const desiredModel = requestedModelKey();
  const indexedItemIds = new Set(existing.map((chunk) => chunk.knowledgeItemId));

  if (
    !force &&
    existing.length > 0 &&
    existing.every((chunk) => chunk.embeddingModel === desiredModel) &&
    approvedItems.every((item) => indexedItemIds.has(item.id))
  ) {
    return desiredModel;
  }

  const pending = approvedItems.flatMap((item) =>
    chunkKnowledge(item).map((content, chunkIndex) => ({
      item,
      content,
      chunkIndex,
    })),
  );
  const { vectors, modelKey } = await createEmbeddings(
    pending.map((entry) => entry.content),
    desiredModel,
  );

  await storage.replaceChunks(
    pending.map((entry, index) => ({
      id: `${entry.item.id}-${entry.chunkIndex}`,
      knowledgeItemId: entry.item.id,
      content: entry.content,
      chunkIndex: entry.chunkIndex,
      embedding: vectors[index],
      embeddingModel: modelKey,
      createdAt: new Date(),
    })),
  );

  return modelKey;
}

async function embedQuestion(question: string, modelKey: string) {
  if (modelKey === LOCAL_MODEL) return localEmbedding(question);
  try {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!.trim(),
    });
    const { embedding } = await embed({
      model: openrouter.textEmbeddingModel(
        process.env.OPENROUTER_EMBEDDING_MODEL!,
      ),
      value: question,
    });
    return embedding;
  } catch (error) {
    console.error("OpenRouter query embedding failed; using demo fallback.", error);
    await rebuildKnowledgeIndex(true);
    return localEmbedding(question);
  }
}

function keywordBonus(question: string, item: KnowledgeItem) {
  const query = normalizeText(question);
  const terms = [item.title, item.category, ...item.tags]
    .flatMap((part) => normalizeText(part).split(" "))
    .filter((term) => term.length > 1);
  const matches = terms.filter((term) => query.includes(term)).length;
  return Math.min(matches * 0.08, 0.24);
}

export async function searchKnowledge(question: string): Promise<KnowledgeSearchResult> {
  let modelKey = await rebuildKnowledgeIndex();
  let queryVector = await embedQuestion(question, modelKey);
  let chunks = storage.provider === "postgres"
    ? await searchPostgresChunks(queryVector, modelKey)
    : await storage.listChunks();

  if (chunks.length > 0 && chunks[0].embedding.length !== queryVector.length) {
    modelKey = await rebuildKnowledgeIndex(true);
    queryVector = await embedQuestion(question, modelKey);
    chunks = storage.provider === "postgres"
      ? await searchPostgresChunks(queryVector, modelKey)
      : await storage.listChunks();
  }

  const approvedItems = await storage.listApprovedKnowledge();
  const itemMap = new Map(approvedItems.map((item) => [item.id, item]));
  const bestByItem = new Map<string, RetrievedKnowledge>();

  for (const chunk of chunks) {
    const item = itemMap.get(chunk.knowledgeItemId);
    if (!item) continue;
    const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
    const lexicalScore = lexicalSimilarity(question, item, chunk.content);
    const score = modelKey === LOCAL_MODEL
      ? vectorScore * 0.72 + lexicalScore * 0.5 + keywordBonus(question, item)
      : vectorScore + lexicalScore * 0.22 + keywordBonus(question, item);
    const existing = bestByItem.get(item.id);
    if (!existing || score > existing.score) {
      bestByItem.set(item.id, { item, excerpt: chunk.content, score });
    }
  }

  // The local hash model is deliberately conservative: a false answer is
  // worse than creating a gap in this governance demo.
  const threshold = modelKey === LOCAL_MODEL ? 0.36 : 0.46;
  const ranked = [...bestByItem.values()].sort((left, right) => right.score - left.score);
  const matches = ranked.filter((entry) => entry.score >= threshold).slice(0, 4);
  const matchedIds = new Set(matches.map((entry) => entry.item.id));
  const relatedFloor = modelKey === LOCAL_MODEL ? 0.16 : 0.2;
  const related = ranked
    .filter((entry) => !matchedIds.has(entry.item.id) && entry.score >= relatedFloor)
    .slice(0, 3);

  return { matches, related };
}

export async function retrieveKnowledge(question: string) {
  return (await searchKnowledge(question)).matches;
}

export function normalizeQuestion(question: string) {
  return normalizeText(question).replace(/[?？]/g, "");
}

export async function recordKnowledgeGap(question: string) {
  const normalizedQuestion = normalizeQuestion(question);
  const existing = await storage.findGapByNormalizedQuestion(normalizedQuestion);
  const now = new Date();

  if (existing) {
    await storage.updateGap(existing.id, {
      count: existing.count + 1,
      lastAskedAt: now,
    });
    return existing.id;
  }

  const id = crypto.randomUUID();
  await storage.createGap({
    id,
    question,
    normalizedQuestion,
    count: 1,
    status: "new",
    firstAskedAt: now,
    lastAskedAt: now,
    resolvedKnowledgeItemId: null,
  });
  return id;
}

export async function listKnowledge() {
  return storage.listKnowledge();
}

export async function listGaps() {
  return storage.listGaps();
}

export async function getKnowledgeOverview() {
  const [knowledge, gaps] = await Promise.all([listKnowledge(), listGaps()]);
  const categoryCounts = new Map<string, number>();
  for (const item of knowledge.filter((entry) => entry.status === "approved")) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }

  return {
    title: "Approved Knowledge by category",
    total: knowledge.length,
    approved: knowledge.filter((item) => item.status === "approved").length,
    draft: knowledge.filter((item) => item.status === "draft").length,
    activeGaps: gaps.filter((gap) => gap.status === "new" || gap.status === "escalated").length,
    categories: [...categoryCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8),
  };
}

export async function markGapEscalated(id: string) {
  const gap = await storage.getGap(id);
  if (!gap || gap.status !== "new") return false;
  return storage.updateGap(id, { status: "escalated" });
}
