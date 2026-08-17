"use client";

import {
  BarChart3,
  BookOpenCheck,
  CircleAlert,
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
