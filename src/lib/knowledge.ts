import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { and, desc, eq } from "drizzle-orm";
import { embed, embedMany } from "ai";

import { db } from "@/db/client";
import {
  knowledgeChunks,
  knowledgeGaps,
  knowledgeItems,
  type KnowledgeItem,
} from "@/db/schema";

const LOCAL_MODEL = "local-hash-v1";
const VECTOR_SIZE = 256;

export type RetrievedKnowledge = {
  item: KnowledgeItem;
  excerpt: string;
  score: number;
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
      apiKey: process.env.OPENROUTER_API_KEY,
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

export async function rebuildKnowledgeIndex(force = false) {
  const approvedItems = db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.status, "approved"))
    .all();
  const existing = db.select().from(knowledgeChunks).all();
  const desiredModel = requestedModelKey();

  if (
    !force &&
    existing.length > 0 &&
    existing.every((chunk) => chunk.embeddingModel === desiredModel)
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

  db.transaction((tx) => {
    tx.delete(knowledgeChunks).run();
    if (pending.length > 0) {
      tx.insert(knowledgeChunks)
        .values(
          pending.map((entry, index) => ({
            id: `${entry.item.id}-${entry.chunkIndex}`,
            knowledgeItemId: entry.item.id,
            content: entry.content,
            chunkIndex: entry.chunkIndex,
            embedding: vectors[index],
            embeddingModel: modelKey,
            createdAt: new Date(),
          })),
        )
        .run();
    }
  });

  return modelKey;
}

async function embedQuestion(question: string, modelKey: string) {
  if (modelKey === LOCAL_MODEL) return localEmbedding(question);
  try {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
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

export async function retrieveKnowledge(question: string) {
  let modelKey = await rebuildKnowledgeIndex();
  let queryVector = await embedQuestion(question, modelKey);
  let chunks = db.select().from(knowledgeChunks).all();

  if (chunks.length > 0 && chunks[0].embedding.length !== queryVector.length) {
    modelKey = await rebuildKnowledgeIndex(true);
    queryVector = await embedQuestion(question, modelKey);
    chunks = db.select().from(knowledgeChunks).all();
  }

  const approvedItems = db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.status, "approved"))
    .all();
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
  return [...bestByItem.values()]
    .filter((entry) => entry.score >= threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

export function normalizeQuestion(question: string) {
  return normalizeText(question).replace(/[?？]/g, "");
}

export function recordKnowledgeGap(question: string) {
  const normalizedQuestion = normalizeQuestion(question);
  const existing = db
    .select()
    .from(knowledgeGaps)
    .where(eq(knowledgeGaps.normalizedQuestion, normalizedQuestion))
    .get();
  const now = new Date();

  if (existing) {
    db.update(knowledgeGaps)
      .set({ count: existing.count + 1, lastAskedAt: now })
      .where(eq(knowledgeGaps.id, existing.id))
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  db.insert(knowledgeGaps)
    .values({
      id,
      question,
      normalizedQuestion,
      count: 1,
      status: "new",
      firstAskedAt: now,
      lastAskedAt: now,
      resolvedKnowledgeItemId: null,
    })
    .run();
  return id;
}

export function listKnowledge() {
  return db.select().from(knowledgeItems).orderBy(desc(knowledgeItems.updatedAt)).all();
}

export function listGaps() {
  return db.select().from(knowledgeGaps).orderBy(desc(knowledgeGaps.lastAskedAt)).all();
}

export function markGapEscalated(id: string) {
  return db
    .update(knowledgeGaps)
    .set({ status: "escalated" })
    .where(and(eq(knowledgeGaps.id, id), eq(knowledgeGaps.status, "new")))
    .run();
}
