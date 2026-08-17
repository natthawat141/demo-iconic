import { beforeEach, describe, expect, it } from "vitest";

import { resetDemoData } from "@/db/client";
import {
  normalizeQuestion,
  recordKnowledgeGap,
  retrieveKnowledge,
} from "@/lib/knowledge";

describe("knowledge demo workflow", () => {
  beforeEach(() => resetDemoData());

  it("retrieves an approved source for a supported question", async () => {
    const results = await retrieveKnowledge("ลูกค้าขอปรึกษาคู่สมรสก่อน ควรตอบอย่างไร");

    expect(results[0]?.item.id).toBe("km-objection-partner");
    expect(results.every((result) => result.item.status === "approved")).toBe(true);
  });

  it("never retrieves the draft claim article", async () => {
    const results = await retrieveKnowledge("ติดตามลูกค้าหลังแจ้งเคลมอย่างไร");

    expect(results.map((result) => result.item.id)).not.toContain("km-claim-care-draft");
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
