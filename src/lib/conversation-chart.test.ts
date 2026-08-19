import { describe, expect, it } from "vitest";

import { chartFromQuestion } from "@/lib/conversation-chart";

describe("conversation chart extraction", () => {
  it("creates a line chart from explicit Thai label-value pairs", () => {
    expect(chartFromQuestion("สร้างกราฟเส้น Timeline โครงการจากข้อมูลนี้: Phase 1 = 30 วัน, Phase 2 = 60 วัน, Phase 3 = 90 วัน, Phase 4 = 120 วัน")).toEqual({
      title: "กราฟเส้น Timeline โครงการ",
      kind: "line",
      points: [
        { label: "Phase 1", value: 30 },
        { label: "Phase 2", value: 60 },
        { label: "Phase 3", value: 90 },
        { label: "Phase 4", value: 120 },
      ],
    });
  });

  it("keeps formatted values numeric and ignores ordinary questions", () => {
    expect(chartFromQuestion("ทำกราฟยอดขาย: ม.ค. = 1,200 บาท, ก.พ. = 2,450 บาท")).toMatchObject({
      kind: "bar",
      points: [{ label: "ม.ค.", value: 1200 }, { label: "ก.พ.", value: 2450 }],
    });
    expect(chartFromQuestion("Phase 1 = 30 วัน")).toBeNull();
  });
});
