import { beforeEach, describe, expect, it } from "vitest";

import { resetDemoData } from "@/db/client";
import {
  normalizeQuestion,
  recordKnowledgeGap,
  retrieveKnowledge,
} from "@/lib/knowledge";

describe("knowledge demo workflow", () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_EMBEDDING_MODEL;
    resetDemoData();
  });

  it("retrieves an approved source for a supported question", async () => {
    const results = await retrieveKnowledge("ลูกค้าขอปรึกษาคู่สมรสก่อน ควรตอบอย่างไร");

    expect(results[0]?.item.id).toBe("km-objection-partner");
    expect(results.every((result) => result.item.status === "approved")).toBe(true);
  });

  it("never retrieves the draft claim article", async () => {
    const results = await retrieveKnowledge("ติดตามลูกค้าหลังแจ้งเคลมอย่างไร");

    expect(results.map((result) => result.item.id)).not.toContain("km-claim-care-draft");
  });

  it.each([
    ["ลูกค้าไม่ตอบ ควรติดตามยังไง", "km-no-response-follow-up"],
    ["ข้อมูลส่วนตัวอะไรห้ามใส่ใน Knowledge", "km-sensitive-data"],
    ["คำตอบ AI ผิดต้องแจ้งที่ไหน", "km-ai-feedback"],
    ["จะเตรียมประชุมออนไลน์ยังไง", "km-remote-meeting"],
  ])("ranks Thai query %s to %s", async (question, expectedId) => {
    const results = await retrieveKnowledge(question);
    expect(results[0]?.item.id).toBe(expectedId);
  });

  it("rejects an unsupported operational question", async () => {
    const results = await retrieveKnowledge("โบนัสไตรมาสนี้จ่ายวันไหน");
    expect(results).toEqual([]);
  });

  it("normalizes and merges repeated knowledge gaps", () => {
    const firstId = recordKnowledgeGap("โบนัสไตรมาสนี้จ่ายวันไหน?");
    const repeatedId = recordKnowledgeGap("  โบนัสไตรมาสนี้จ่ายวันไหน  ");

    expect(repeatedId).toBe(firstId);
    expect(normalizeQuestion("โบนัสไตรมาสนี้จ่ายวันไหน?")).toBe(
      "โบนัสไตรมาสนี้จ่ายวันไหน",
    );
  });
});
