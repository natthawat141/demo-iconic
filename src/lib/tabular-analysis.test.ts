import { describe, expect, it } from "vitest";

import {
  analyzeTabularData,
  parseCsv,
  TabularAnalysisError,
} from "@/lib/tabular-analysis";

describe("tabular analysis", () => {
  it("parses quoted CSV cells and recommends a category comparison chart", () => {
    const analysis = analyzeTabularData({
      format: "csv",
      sheetName: "ยอดขาย",
      content: 'ทีม,ยอดขาย\r\n"ทีม, กรุงเทพ",120\r\nเชียงใหม่,80\r\n',
    });

    expect(analysis.selectedSheet).toMatchObject({ name: "ยอดขาย", rowCount: 2, columnCount: 2 });
    expect(analysis.selectedSheet.columns[1]).toMatchObject({
      name: "ยอดขาย",
      kind: "number",
      numeric: { min: 80, max: 120, sum: 200, average: 100 },
    });
    expect(analysis.chart).toEqual({
      kind: "bar",
      labelColumn: "ทีม",
      valueColumn: "ยอดขาย",
      aggregation: "sum",
      title: "ยอดขาย by ทีม",
      points: [
        { label: "ทีม, กรุงเทพ", value: 120 },
        { label: "เชียงใหม่", value: 80 },
      ],
    });
  });

  it("chooses a date trend only when a real date column and numeric values exist", () => {
    const analysis = analyzeTabularData({
      format: "workbook",
      sheets: [
        { name: "ว่าง", rows: [["ชื่อ"]] },
        {
          name: "รายวัน",
          rows: [["วันที่", "จำนวน"], ["2026-08-01", 4], ["2026-08-02", 9], ["2026-08-01", 2]],
        },
      ],
    });

    expect(analysis.selectedSheet.name).toBe("รายวัน");
    expect(analysis.chart).toMatchObject({
      kind: "line",
      labelColumn: "วันที่",
      valueColumn: "จำนวน",
      points: [{ label: "2026-08-01", value: 6 }, { label: "2026-08-02", value: 9 }],
    });
  });

  it("prefers a sales-value column over the first count column", () => {
    const analysis = analyzeTabularData({
      format: "csv",
      content: "date,leads,revenue_thb\n2026-07-01,20,120000\n2026-07-08,25,180000\n",
    });

    expect(analysis.chart).toMatchObject({
      kind: "line",
      labelColumn: "date",
      valueColumn: "revenue_thb",
      points: [{ label: "2026-07-01", value: 120000 }, { label: "2026-07-08", value: 180000 }],
    });
  });

  it("keeps formatted Excel currency numeric for a trend chart", () => {
    const analysis = analyzeTabularData({
      format: "workbook",
      sheets: [{
        name: "ค่าใช้จ่าย",
        rows: [
          ["เดือน", "ยอดเบิกจ่าย (บาท)"],
          ["2026-01-01", "118,000"],
          ["2026-02-01", "126,000"],
        ],
      }],
    });

    expect(analysis.selectedSheet.columns[1]).toMatchObject({
      kind: "number",
      numeric: { sum: 244000 },
    });
    expect(analysis.chart).toMatchObject({
      kind: "line",
      valueColumn: "ยอดเบิกจ่าย (บาท)",
    });
    expect(analysis.chart?.points[0]).toEqual({ label: "2026-01-01", value: 118000 });
  });

  it("computes grouped totals from every row for follow-up questions", () => {
    const analysis = analyzeTabularData({
      format: "csv",
      content: "team,revenue\nNorth,100\nCentral,250\nNorth,50\nCentral,300\n",
    });

    expect(analysis.breakdowns).toContainEqual({
      labelColumn: "team",
      valueColumn: "revenue",
      aggregation: "sum",
      points: [{ label: "Central", value: 550 }, { label: "North", value: 150 }],
    });
  });

  it("does not invent a chart for text-only data", () => {
    const analysis = analyzeTabularData({
      format: "csv",
      content: "หัวข้อ,หมายเหตุ\nA,ดี\nB,ต้องตรวจ\n",
    });

    expect(analysis.chart).toBeNull();
    expect(analysis.caveats[0]).toContain("ไม่ยืนยันความหมายทางธุรกิจ");
  });

  it("normalizes duplicate and blank headers deterministically", () => {
    const analysis = analyzeTabularData({
      format: "csv",
      content: "ยอด,ยอด,\n1,2,3\n",
    });

    expect(analysis.selectedSheet.columns.map((column) => column.name)).toEqual([
      "ยอด",
      "ยอด (2)",
      "Column 3",
    ]);
  });

  it("rejects malformed, empty, and structurally unsafe inputs", () => {
    expect(() => parseCsv('ชื่อ,ยอด\n"unterminated')).toThrow(TabularAnalysisError);
    expect(() => parseCsv('ชื่อ\n"quoted"text')).toThrow(TabularAnalysisError);
    expect(() => analyzeTabularData({ format: "csv", content: " \n" })).toThrow("ว่างเปล่า");
    expect(() => analyzeTabularData({
      format: "workbook",
      sheets: [{ name: "ข้อมูล", rows: [["A"], ["1", "2"]] }],
    })).toThrow("เกินจำนวนคอลัมน์");
  });
});
