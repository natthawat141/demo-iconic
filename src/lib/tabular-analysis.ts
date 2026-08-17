export type TabularCell = string | number | boolean | null | undefined;

export interface TabularSheetInput {
  name: string;
  /** First row is the header. Values must already have been decoded from XLS/XLSX. */
  rows: TabularCell[][];
}

export type TabularInput =
  | { format: "csv"; content: string; sheetName?: string }
  | { format: "workbook"; sheets: TabularSheetInput[] };

export type ColumnKind = "empty" | "number" | "date" | "boolean" | "string" | "mixed";

export interface ColumnSummary {
  name: string;
  kind: ColumnKind;
  nonEmptyCount: number;
  emptyCount: number;
  uniqueCount: number;
  numeric?: { min: number; max: number; sum: number; average: number };
}

export interface TabularSheetSummary {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnSummary[];
  previewRows: string[][];
}

export interface ChartSpec {
  kind: "bar" | "line";
  labelColumn: string;
  valueColumn: string;
  aggregation: "sum";
  title: string;
  points: Array<{ label: string; value: number }>;
}

export interface TabularAnalysis {
  selectedSheet: TabularSheetSummary;
  sheets: Array<Pick<TabularSheetSummary, "name" | "rowCount" | "columnCount">>;
  chart: ChartSpec | null;
  caveats: string[];
}

export class TabularAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TabularAnalysisError";
  }
}

export const TABULAR_ANALYSIS_LIMITS = {
  maxCsvCharacters: 2_000_000,
  maxSheets: 20,
  maxRowsPerSheet: 10_001,
  maxColumns: 100,
  maxCellCharacters: 10_000,
  maxPreviewRows: 5,
  maxChartPoints: 12,
} as const;

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function cellToText(value: TabularCell) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TabularAnalysisError("พบตัวเลขที่ไม่ถูกต้องในตาราง");
    return String(value);
  }
  if (typeof value !== "string") throw new TabularAnalysisError("พบชนิดข้อมูลที่ไม่รองรับในตาราง");
  if (value.length > TABULAR_ANALYSIS_LIMITS.maxCellCharacters) {
    throw new TabularAnalysisError("พบเซลล์ที่มีข้อความยาวเกินขีดจำกัด");
  }
  return value.trim();
}

/** RFC 4180-style CSV parsing with quoted fields and CRLF support. */
export function parseCsv(content: string): string[][] {
  if (!content.trim()) throw new TabularAnalysisError("ไฟล์ CSV ว่างเปล่า");
  if (content.length > TABULAR_ANALYSIS_LIMITS.maxCsvCharacters) {
    throw new TabularAnalysisError("ไฟล์ CSV มีขนาดเกินขีดจำกัดสำหรับเดโม");
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let justClosedQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        cell += character;
      }
      if (cell.length > TABULAR_ANALYSIS_LIMITS.maxCellCharacters) {
        throw new TabularAnalysisError("พบเซลล์ที่มีข้อความยาวเกินขีดจำกัด");
      }
      continue;
    }

    if (character === '"') {
      if (cell.length !== 0) throw new TabularAnalysisError("รูปแบบ CSV ไม่ถูกต้อง: เครื่องหมายอัญประกาศอยู่ผิดตำแหน่ง");
      quoted = true;
    } else if (justClosedQuote && character !== "," && character !== "\n" && character !== "\r") {
      throw new TabularAnalysisError("รูปแบบ CSV ไม่ถูกต้อง: พบข้อความหลังเครื่องหมายอัญประกาศ");
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
      justClosedQuote = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      justClosedQuote = false;
    } else {
      cell += character;
    }
    if (cell.length > TABULAR_ANALYSIS_LIMITS.maxCellCharacters) {
      throw new TabularAnalysisError("พบเซลล์ที่มีข้อความยาวเกินขีดจำกัด");
    }
  }

  if (quoted) throw new TabularAnalysisError("รูปแบบ CSV ไม่ถูกต้อง: เครื่องหมายอัญประกาศไม่ครบ");
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function toHeaders(row: string[]) {
  if (row.length === 0 || row.every((value) => !value.trim())) {
    throw new TabularAnalysisError("ไม่พบแถวหัวตาราง");
  }
  if (row.length > TABULAR_ANALYSIS_LIMITS.maxColumns) {
    throw new TabularAnalysisError("ตารางมีจำนวนคอลัมน์เกินขีดจำกัด");
  }
  const seen = new Map<string, number>();
  return row.map((raw, index) => {
    const base = raw.trim() || `Column ${index + 1}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return occurrence === 1 ? base : `${base} (${occurrence})`;
  });
}

function classify(values: string[]): ColumnKind {
  const filled = values.filter(Boolean);
  if (filled.length === 0) return "empty";
  if (filled.every((value) => NUMBER_PATTERN.test(value) && Number.isFinite(Number(value)))) return "number";
  if (filled.every((value) => /^(true|false)$/i.test(value))) return "boolean";
  if (filled.every((value) => DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value)))) return "date";
  const recognized = filled.filter((value) => NUMBER_PATTERN.test(value) || DATE_PATTERN.test(value) || /^(true|false)$/i.test(value));
  return recognized.length === 0 ? "string" : "mixed";
}

function summarizeSheet(input: TabularSheetInput): { summary: TabularSheetSummary; values: string[][] } {
  const name = input.name.trim();
  if (!name) throw new TabularAnalysisError("พบชีตที่ไม่มีชื่อ");
  if (input.rows.length === 0) throw new TabularAnalysisError(`ชีต ${name} ว่างเปล่า`);
  if (input.rows.length > TABULAR_ANALYSIS_LIMITS.maxRowsPerSheet) {
    throw new TabularAnalysisError(`ชีต ${name} มีจำนวนแถวเกินขีดจำกัด`);
  }
  const headers = toHeaders(input.rows[0].map(cellToText));
  const values = input.rows.slice(1).map((sourceRow) => {
    if (sourceRow.length > headers.length) {
      throw new TabularAnalysisError(`ชีต ${name} มีข้อมูลเกินจำนวนคอลัมน์ของหัวตาราง`);
    }
    return headers.map((_, index) => cellToText(sourceRow[index]));
  });
  const columns = headers.map((header, index) => {
    const columnValues = values.map((row) => row[index]);
    const kind = classify(columnValues);
    const nonEmpty = columnValues.filter(Boolean);
    const summary: ColumnSummary = {
      name: header,
      kind,
      nonEmptyCount: nonEmpty.length,
      emptyCount: columnValues.length - nonEmpty.length,
      uniqueCount: new Set(nonEmpty).size,
    };
    if (kind === "number") {
      const numbers = nonEmpty.map(Number);
      const sum = numbers.reduce((total, value) => total + value, 0);
      summary.numeric = {
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        sum,
        average: sum / numbers.length,
      };
    }
    return summary;
  });
  return {
    summary: {
      name,
      rowCount: values.length,
      columnCount: headers.length,
      columns,
      previewRows: values.slice(0, TABULAR_ANALYSIS_LIMITS.maxPreviewRows),
    },
    values,
  };
}

function aggregateChart(
  labelIndex: number,
  valueIndex: number,
  values: string[][],
  chartKind: ChartSpec["kind"],
  columns: ColumnSummary[],
) {
  const totals = new Map<string, number>();
  for (const row of values) {
    const label = row[labelIndex];
    const value = Number(row[valueIndex]);
    if (!label || !Number.isFinite(value)) continue;
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  const points = [...totals].map(([label, value]) => ({ label, value }));
  if (chartKind === "line") points.sort((left, right) => left.label.localeCompare(right.label));
  if (points.length < 2 || points.length > TABULAR_ANALYSIS_LIMITS.maxChartPoints) return null;
  return {
    kind: chartKind,
    labelColumn: columns[labelIndex].name,
    valueColumn: columns[valueIndex].name,
    aggregation: "sum" as const,
    title: `${columns[valueIndex].name} by ${columns[labelIndex].name}`,
    points,
  };
}

function recommendChart(summary: TabularSheetSummary, values: string[][]): ChartSpec | null {
  const numericIndex = summary.columns.findIndex((column) => column.kind === "number");
  if (numericIndex === -1) return null;
  const dateIndex = summary.columns.findIndex((column) => column.kind === "date");
  if (dateIndex !== -1) return aggregateChart(dateIndex, numericIndex, values, "line", summary.columns);
  const categoryIndex = summary.columns.findIndex((column) => column.kind === "string" || column.kind === "boolean");
  if (categoryIndex !== -1) return aggregateChart(categoryIndex, numericIndex, values, "bar", summary.columns);
  return null;
}

/**
 * Analyses CSV text or a workbook that has already been decoded by the upload layer.
 * Binary XLS/XLSX decoding is intentionally outside this pure dependency-free module.
 */
export function analyzeTabularData(input: TabularInput): TabularAnalysis {
  const sheets: TabularSheetInput[] = input.format === "csv"
    ? [{ name: input.sheetName?.trim() || "CSV", rows: parseCsv(input.content) }]
    : input.sheets;
  if (sheets.length === 0) throw new TabularAnalysisError("ไม่พบชีตในไฟล์ตาราง");
  if (sheets.length > TABULAR_ANALYSIS_LIMITS.maxSheets) {
    throw new TabularAnalysisError("ไฟล์มีจำนวนชีตเกินขีดจำกัด");
  }
  const analysed = sheets.map(summarizeSheet);
  const selected = analysed.find(({ summary }) => summary.rowCount > 0) ?? analysed[0];
  if (selected.summary.rowCount === 0) throw new TabularAnalysisError("ไม่พบข้อมูลใต้หัวตาราง");

  const caveats = ["สรุปนี้คำนวณจากค่าที่อ่านได้ในชีตที่เลือก และไม่ยืนยันความหมายทางธุรกิจของคอลัมน์"];
  if (selected.summary.columns.some((column) => column.emptyCount > 0)) {
    caveats.push("บางคอลัมน์มีค่าว่าง จึงไม่รวมแถวนั้นในจุดข้อมูลของกราฟ")
  }
  if (selected.summary.columns.some((column) => column.kind === "mixed")) {
    caveats.push("บางคอลัมน์มีชนิดข้อมูลปะปน จึงไม่นำมาใช้คำนวณเป็นตัวเลขหรือวันที่")
  }

  return {
    selectedSheet: selected.summary,
    sheets: analysed.map(({ summary }) => ({
      name: summary.name,
      rowCount: summary.rowCount,
      columnCount: summary.columnCount,
    })),
    chart: recommendChart(selected.summary, selected.values),
    caveats,
  };
}
