"use client";

import {
  BarChart3,
  BookOpenCheck,
  CircleAlert,
  Globe2,
  LoaderCircle,
} from "lucide-react";
import type { ToolCallMessagePartStatus } from "@assistant-ui/react";

type SearchResult = {
  found: boolean;
  resultCount?: number;
  related?: Array<{ title: string }>;
};

type OverviewResult = {
  title: string;
  total: number;
  approved: number;
  draft: number;
  activeGaps: number;
  categories: Array<{ label: string; value: number }>;
};

export type ConversationChartResult = {
  title: string;
  kind: "bar" | "line";
  points: Array<{ label: string; value: number }>;
};

type WebSearchResult = {
  available: boolean;
  resultCount?: number;
};

function isSearchResult(value: unknown): value is SearchResult {
  return Boolean(value && typeof value === "object" && "found" in value);
}

function isOverviewResult(value: unknown): value is OverviewResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "categories" in value &&
      Array.isArray((value as OverviewResult).categories),
  );
}

function isConversationChartResult(value: unknown): value is ConversationChartResult {
  return Boolean(
    value && typeof value === "object" &&
      "title" in value && "kind" in value && "points" in value &&
      Array.isArray((value as ConversationChartResult).points),
  );
}

function isWebSearchResult(value: unknown): value is WebSearchResult {
  return Boolean(value && typeof value === "object" && "available" in value);
}

export function WebSearchTool({
  status,
  result,
}: {
  status?: ToolCallMessagePartStatus;
  result?: unknown;
}) {
  if (status?.type === "running") return null;
  const data = isWebSearchResult(result) ? result : null;
  if (!data?.available) return null;
  return (
    <div className="my-2 flex w-fit max-w-full items-center gap-2 text-xs text-muted-foreground">
      <Globe2 className="size-3.5 text-primary" aria-hidden="true" />
      <span>ค้นข้อมูลบนเว็บแล้ว {data.resultCount ?? 0} แหล่ง</span>
    </div>
  );
}

export function KnowledgeSearchTool({
  status,
  result,
}: {
  status?: ToolCallMessagePartStatus;
  result?: unknown;
}) {
  const running = status?.type === "running";
  const data = isSearchResult(result) ? result : null;
  const found = data?.found === true;

  return (
    <div className="my-2 flex w-fit max-w-full items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-2 text-xs text-muted-foreground ring-1 ring-border/70">
      {running ? (
        <LoaderCircle className="size-3.5 animate-spin text-primary" />
      ) : found ? (
        <BookOpenCheck className="size-3.5 text-[oklch(0.55_0.14_150)]" />
      ) : (
        <CircleAlert className="size-3.5 text-[oklch(0.62_0.14_75)]" />
      )}
      <span>
        {running
          ? "กำลังเปิดคลังความรู้ของทีม..."
          : found
            ? `ตรวจ Knowledge แล้ว ${data.resultCount ?? 0} แหล่ง`
            : `ยังไม่มีคำตอบตรงคำถาม${data?.related?.length ? ` · พบเรื่องใกล้เคียง ${data.related.length} รายการ` : ""}`}
      </span>
    </div>
  );
}

export function KnowledgeOverviewTool({
  status,
  result,
}: {
  status?: ToolCallMessagePartStatus;
  result?: unknown;
}) {
  if (status?.type === "running" || !isOverviewResult(result)) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">
        <LoaderCircle className="size-4 animate-spin text-primary" /> กำลังสร้างภาพรวม Knowledge...
      </div>
    );
  }

  const max = Math.max(...result.categories.map((item) => item.value), 1);
  return (
    <figure className="my-4 overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <figcaption className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="size-4 text-primary" /> ภาพรวมคลังความรู้
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Approved Knowledge แยกตามหมวดหมู่</p>
        </div>
        <span className="font-mono text-xl font-semibold">{result.approved}</span>
      </figcaption>
      <div className="grid grid-cols-3 gap-px bg-border text-center">
        {[
          ["ทั้งหมด", result.total],
          ["Draft", result.draft],
          ["Active gaps", result.activeGaps],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-muted/35 px-2 py-2.5">
            <div className="font-mono text-sm font-semibold">{value}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3 p-4" role="img" aria-label={`กราฟ Knowledge ที่อนุมัติแล้ว ${result.approved} รายการ แยกตามหมวดหมู่`}>
        {result.categories.map((item, index) => (
          <div key={item.label} className="grid grid-cols-[minmax(90px,150px)_1fr_24px] items-center gap-3">
            <span className="truncate text-xs text-muted-foreground" title={item.label}>{item.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max((item.value / max) * 100, 5)}%`,
                  background: `var(--chart-${(index % 5) + 1})`,
                }}
              />
            </span>
            <span className="text-right font-mono text-xs font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function ConversationChartTool({
  status,
  result,
}: {
  status?: ToolCallMessagePartStatus;
  result?: unknown;
}) {
  if (status?.type === "running" || !isConversationChartResult(result)) {
    return <div className="my-3 flex items-center gap-2 rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border"><LoaderCircle className="size-4 animate-spin text-primary" /> กำลังจัดข้อมูลเป็นกราฟ...</div>;
  }
  return <ConversationChart result={result} />;
}

export function ConversationChart({ result }: { result: ConversationChartResult }) {
  const max = Math.max(...result.points.map((point) => point.value), 1);
  const range = max;
  const linePoints = result.points.map((point, index) => {
    const x = result.points.length === 1 ? 50 : 6 + (index / (result.points.length - 1)) * 88;
    const y = 92 - (point.value / range) * 80;
    return `${x},${y}`;
  }).join(" ");
  return <figure className="my-4 overflow-hidden rounded-xl bg-card ring-1 ring-border">
    <figcaption className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold"><BarChart3 className="size-4 text-primary" /> {result.title}</figcaption>
    <div className="p-4">
      {result.kind === "line" ? <div className="h-40" role="img" aria-label={result.title}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
          <line x1="6" x2="94" y1="92" y2="92" stroke="currentColor" className="text-border" strokeWidth="0.7" />
          <polyline fill="none" points={linePoints} stroke="var(--color-primary)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          {result.points.map((point, index) => {
            const [x, y] = linePoints.split(" ")[index]!.split(",");
            return <circle key={point.label} cx={x} cy={y} r="1.8" fill="var(--color-primary)" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
      </div> : <div className="flex h-40 items-end gap-2 border-b border-border/80 pb-1" role="img" aria-label={result.title}>
        {result.points.map((point) => <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-muted-foreground">{point.value.toLocaleString()}</span><span className="w-full min-w-3 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(7, (point.value / max) * 100)}%` }} /></div>)}
      </div>}
      <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5 text-center sm:grid-cols-6">{result.points.map((point) => <span key={point.label} className="truncate text-[10px] text-muted-foreground" title={`${point.label}: ${point.value}`}>{point.label}</span>)}</div>
    </div>
  </figure>;
}
