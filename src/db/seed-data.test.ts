import { describe, expect, it } from "vitest";

import { seedKnowledge } from "@/db/seed-data";

describe("Sales Workspace demo Knowledge", () => {
  const salesWorkspaceItems = seedKnowledge.filter((item) => item.id.startsWith("km-sales-"));
  const mockupInsuranceItems = seedKnowledge.filter((item) => item.id.startsWith("km-mockup-insurance-"));

  it("ships a broad, clearly-labelled sales demo corpus", () => {
    expect(salesWorkspaceItems).toHaveLength(81);
    expect(salesWorkspaceItems.every((item) => item.status === "approved")).toBe(true);
    expect(salesWorkspaceItems.every((item) => item.sourceLabel.includes("ข้อมูลจำลองสำหรับ Demo"))).toBe(true);
  });

  it("keeps every seed identifier unique", () => {
    expect(new Set(seedKnowledge.map((item) => item.id)).size).toBe(seedKnowledge.length);
  });

  it("ships mockup insurance packages and claims guidance without presenting it as real policy data", () => {
    expect(mockupInsuranceItems).toHaveLength(14);
    expect(mockupInsuranceItems.every((item) => item.status === "approved")).toBe(true);
    expect(mockupInsuranceItems.every((item) => item.sourceLabel.includes("ข้อมูลจำลองสำหรับ Demo"))).toBe(true);
    expect(mockupInsuranceItems.some((item) => item.title.includes("Health Secure Plus"))).toBe(true);
    expect(mockupInsuranceItems.some((item) => item.title.includes("วิธีกรอกแบบฟอร์มเคลม"))).toBe(true);
    expect(mockupInsuranceItems.every((item) => item.content.includes("ข้อมูลจำลองสำหรับ Demo"))).toBe(true);
  });
});
