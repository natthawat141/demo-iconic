export type ConversationChart = {
  title: string;
  kind: "bar" | "line";
  points: Array<{ label: string; value: number }>;
};

const CHART_REQUEST_PATTERN = /(chart|graph|กราฟ|แผนภูมิ|visuali[sz]e)/iu;
const LINE_CHART_PATTERN = /(กราฟเส้น|line\s*chart|line graph)/iu;
const DATA_SEGMENT_PATTERN = /(?:จาก)?(?:ข้อมูล(?:นี้|ดังนี้)?|data)\s*[:：]\s*(.+)$/iu;
const PAIR_PATTERN = /(?:^|[,;\n]|:\s*)([^=,:;\n]{1,64}?)\s*(?:=|:)\s*([0-9][\d,]*(?:\.\d+)?)(?=\s*(?:บาท|วัน|คน|ครั้ง|เคส|รายการ|%|เปอร์เซ็นต์)?\s*(?:[,;\n]|$))/gu;

function numericValue(value: string) {
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function chartTitle(question: string, kind: ConversationChart["kind"]) {
  const prefix = question
    .split(/(?:จาก)?(?:ข้อมูล(?:นี้|ดังนี้)?|data)\s*[:：]?/iu)[0]
    .replace(/(?:ช่วย|สร้าง|ทำ|แสดง|ให้|กราฟเส้น|กราฟแท่ง|กราฟ|แผนภูมิ|line\s*chart|bar\s*chart|line graph|bar graph)/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const type = kind === "line" ? "กราฟเส้น" : "กราฟแท่ง";
  return prefix ? `${type} ${prefix}` : `${type}จากข้อมูลที่ระบุ`;
}

/**
 * Extracts explicit label=value pairs for a user-requested chart. This keeps
 * chart data deterministic instead of relying on a model-generated JSON blob.
 */
export function chartFromQuestion(question: string): ConversationChart | null {
  if (!CHART_REQUEST_PATTERN.test(question)) return null;
  const input = DATA_SEGMENT_PATTERN.exec(question)?.[1] ?? question;
  const points = [...input.matchAll(PAIR_PATTERN)]
    .flatMap((match) => {
      const label = match[1]?.trim();
      const value = match[2] ? numericValue(match[2]) : null;
      return label && value !== null ? [{ label, value }] : [];
    })
    .slice(0, 12);
  if (points.length === 0) return null;

  const kind = LINE_CHART_PATTERN.test(question) ? "line" : "bar";
  return { title: chartTitle(question, kind), kind, points };
}

export function isConversationChart(value: unknown): value is ConversationChart {
  if (!value || typeof value !== "object") return false;
  const chart = value as Partial<ConversationChart>;
  return typeof chart.title === "string" &&
    (chart.kind === "bar" || chart.kind === "line") &&
    Array.isArray(chart.points) &&
    chart.points.length > 0 &&
    chart.points.length <= 12 &&
    chart.points.every((point) =>
      Boolean(point) &&
      typeof point.label === "string" &&
      typeof point.value === "number" &&
      Number.isFinite(point.value) &&
      point.value >= 0,
    );
}
