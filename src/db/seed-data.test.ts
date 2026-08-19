import { describe, expect, it } from "vitest";

import { seedKnowledge } from "@/db/seed-data";

describe("Sales Workspace demo Knowledge", () => {
  const salesWorkspaceItems = seedKnowledge.filter((item) => item.id.startsWith("km-sales-"));

  it("ships a broad, clearly-labelled sales demo corpus", () => {
    expect(salesWorkspaceItems).toHaveLength(81);
    expect(salesWorkspaceItems.every((item) => item.status === "approved")).toBe(true);
    expect(salesWorkspaceItems.every((item) => item.sourceLabel.includes("ข้อมูลจำลองสำหรับ Demo"))).toBe(true);
  });

  it("keeps every seed identifier unique", () => {
    expect(new Set(seedKnowledge.map((item) => item.id)).size).toBe(seedKnowledge.length);
  });
});
