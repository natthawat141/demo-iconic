import { describe, expect, it } from "vitest";

import type { UserMemory } from "@/db/activity-types";
import {
  explicitMemoryFromQuestion,
  isSensitiveMemory,
  normalizeMemoryContent,
  rankMemories,
  shouldOfferMemoryTool,
} from "@/lib/user-memory";

const memories: UserMemory[] = [
  {
    id: "memory-one", userId: "user-one", content: "เรียกฉันว่า Bill และตอบให้กระชับ", kind: "preference",
    sourceConversationId: null, sourceMessageId: null, embedding: null, embeddingModel: null,
    createdAt: new Date("2026-08-01"), updatedAt: new Date("2026-08-10"), lastUsedAt: null,
  },
  {
    id: "memory-two", userId: "user-one", content: "โปรเจกต์นี้ใช้ PostgreSQL และ pgvector", kind: "project",
    sourceConversationId: null, sourceMessageId: null, embedding: null, embeddingModel: null,
    createdAt: new Date("2026-08-02"), updatedAt: new Date("2026-08-11"), lastUsedAt: null,
  },
];

describe("user memory rules", () => {
  it("normalizes an explicit memory request and offers the write tool", () => {
    expect(explicitMemoryFromQuestion("จำไว้ว่า   เรียกฉันว่า Bill")).toBe("จำไว้ว่า เรียกฉันว่า Bill");
    expect(shouldOfferMemoryTool("โปรเจกต์นี้ใช้ PostgreSQL นะ")).toBe(true);
  });

  it("does not open a write tool when the user is only asking what is remembered", () => {
    expect(shouldOfferMemoryTool("คุณจำอะไรเกี่ยวกับฉันบ้าง")).toBe(false);
    expect(rankMemories("คุณจำอะไรเกี่ยวกับฉันบ้าง", memories).map((memory) => memory.id)).toEqual(["memory-two", "memory-one"]);
  });

  it("keeps content bounded and rejects sensitive data", () => {
    expect(normalizeMemoryContent("  ตอบแบบกระชับ\n")).toBe("ตอบแบบกระชับ");
    expect(isSensitiveMemory("รหัสผ่านของฉันคือ abc")).toBe(true);
    expect(isSensitiveMemory("ชอบคำตอบที่มีตาราง")).toBe(false);
  });

  it("ranks a lexical project match ahead of an unrelated preference", () => {
    expect(rankMemories("ฐานข้อมูล PostgreSQL ของโปรเจกต์นี้", memories)[0]?.id).toBe("memory-two");
  });
});
