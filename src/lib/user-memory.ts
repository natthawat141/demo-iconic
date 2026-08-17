import "server-only";

import { activityStorage } from "@/db/activity-storage";
import type { NewUserMemory, UserMemory, UserMemoryKind } from "@/db/activity-types";
import { cosineSimilarity, createSemanticEmbedding } from "@/lib/knowledge";

const MAX_MEMORY_LENGTH = 420;
const SENSITIVE_PATTERN = /(?:password|passcode|api[_ -]?key|secret|เครดิต(?:การ์ด)?|บัตรประชาชน|เลขบัตร|passport|พาสปอร์ต|รหัสผ่าน|ที่อยู่(?:บ้าน)?|ข้อมูลสุขภาพ|โรค(?:ประจำตัว)?)/i;
const MEMORY_REQUEST_PATTERN = /(?:จำ(?:ไว้)?|remember|อย่าลืม|เรียก(?:ฉัน|ผม)ว่า|my name is|ฉันชื่อ|ผมชื่อ|ฉันชอบ|ผมชอบ|ฉันต้องการ|ผมต้องการ|โปรเจกต์(?:นี้)?(?:ใช้|คือ)|ทีม(?:เรา)?(?:ใช้|ทำ)|เรา(?:จะ|ใช้))/i;
const MEMORY_QUESTION_PATTERN = /(?:จำอะไร(?:เกี่ยวกับ)?(?:ฉัน|ผม)|ความจำ(?:ของ)?(?:ฉัน|ผม)|what do you remember)/i;

export type MemoryCandidate = Pick<UserMemory, "id" | "content" | "kind" | "updatedAt"> & {
  score: number;
};

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("th").replace(/\s+/g, " ").trim();
}

export function normalizeMemoryContent(value: string) {
  // NFC keeps Thai sara am in its usual composed form, so Thai intent rules
  // remain stable while whitespace is normalized.
  return value.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_LENGTH);
}

export function isSensitiveMemory(value: string) {
  return SENSITIVE_PATTERN.test(value);
}

export function shouldOfferMemoryTool(question: string) {
  return !MEMORY_QUESTION_PATTERN.test(question) && MEMORY_REQUEST_PATTERN.test(question);
}

export function explicitMemoryFromQuestion(question: string) {
  const value = normalizeMemoryContent(question);
  return /^(?:จำไว้ว่า|อย่าลืมว่า|remember(?:\s+that)?|เรียก(?:ฉัน|ผม)ว่า|my name is)/i.test(value)
    ? value
    : null;
}

function lexicalScore(question: string, memory: string) {
  const query = normalized(question).split(" ").filter((part) => part.length > 1);
  if (query.length === 0) return 0;
  const source = normalized(memory);
  return query.filter((part) => source.includes(part)).length / query.length;
}

export function rankMemories(question: string, memories: UserMemory[], limit = 4): MemoryCandidate[] {
  const listAll = MEMORY_QUESTION_PATTERN.test(question);
  return memories
    .map((memory) => {
      // getRelevantMemories adds a semantic score when an embedding is
      // available. This pure helper is intentionally lexical-only.
      return { id: memory.id, content: memory.content, kind: memory.kind, updatedAt: memory.updatedAt, score: listAll ? 1 : lexicalScore(question, memory.content) };
    })
    .filter((memory) => listAll || memory.score >= 0.2)
    .sort((left, right) => right.score - left.score || right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(0, Math.max(1, Math.min(8, limit)));
}

export async function getRelevantMemories(userId: string, question: string) {
  const memories = await activityStorage.listUserMemories(userId, 100);
  if (memories.length === 0) return [] as MemoryCandidate[];

  const listAll = MEMORY_QUESTION_PATTERN.test(question);
  if (listAll) {
    return memories.slice(0, 5).map((memory) => ({
      id: memory.id,
      content: memory.content,
      kind: memory.kind,
      updatedAt: memory.updatedAt,
      score: 1,
    }));
  }

  const { vector, modelKey } = await createSemanticEmbedding(question);
  const ranked = memories
    .map((memory) => ({
      id: memory.id,
      content: memory.content,
      kind: memory.kind,
      updatedAt: memory.updatedAt,
      score: Math.max(
        memory.embedding && memory.embeddingModel === modelKey
          ? cosineSimilarity(vector, memory.embedding)
          : 0,
        lexicalScore(question, memory.content),
      ),
    }))
    .filter((memory) => memory.score >= 0.34)
    .sort((left, right) => right.score - left.score || right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(0, 4);
  await activityStorage.markUserMemoriesUsed(ranked.map((memory) => memory.id), userId);
  return ranked;
}

export function memoryContext(memories: MemoryCandidate[]) {
  if (memories.length === 0) return "";
  return memories.map((memory) => `- [${memory.kind}] ${memory.content}`).join("\n");
}

export async function saveUserMemory(input: {
  userId: string;
  content: string;
  kind: UserMemoryKind;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
}) {
  const content = normalizeMemoryContent(input.content);
  if (content.length < 3) throw new Error("ความจำต้องมีอย่างน้อย 3 ตัวอักษร");
  if (isSensitiveMemory(content)) throw new Error("เพื่อความเป็นส่วนตัว ระบบไม่เก็บรหัสผ่าน ข้อมูลการชำระเงิน หรือข้อมูลอ่อนไหว");

  const existing = await activityStorage.listUserMemories(input.userId, 100);
  const duplicate = existing.find((memory) => normalized(memory.content) === normalized(content));
  const { vector, modelKey } = await createSemanticEmbedding(content);
  const memory: NewUserMemory = {
    id: duplicate?.id,
    userId: input.userId,
    content,
    kind: input.kind,
    sourceConversationId: input.sourceConversationId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    embedding: vector,
    embeddingModel: modelKey,
  };
  return activityStorage.saveUserMemory(memory);
}
