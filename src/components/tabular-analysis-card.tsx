"use client";

import type { DataMessagePartProps } from "@assistant-ui/react";
import { BarChart3, Table2 } from "lucide-react";

import type { TabularAnalysisData } from "@/lib/demo-types";

function BarChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="flex h-36 items-end gap-2 border-b border-border/80 pb-1">
      {points.map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] text-muted-foreground">{point.value.toLocaleString()}</span>
          <span className="w-full min-w-3 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(7, (point.value / maxValue) * 100)}%` }} />
          <span className="max-w-full truncate text-[10px] text-muted-foreground" title={point.label}>{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const width = 560;
  const height = 136;
  const max = Math.max(...points.map((point) => point.value), 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: height - (point.value / max) * (height - 18),
  }));
  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="กราฟเส้นจากไฟล์ข้อมูล">
        <path d={coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" />
        {coordinates.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="4" className="fill-primary" />)}
      </svg>
      <div className="flex justify-between gap-2 border-t border-border/80 pt-1 text-[10px] text-muted-foreground">
        {coordinates.map((point) => <span key={point.label} className="min-w-0 flex-1 truncate text-center" title={`${point.label}: ${point.value.toLocaleString()}`}>{point.label}</span>)}
      </div>
    </div>
  );
}

export function TabularAnalysisCard({ data }: DataMessagePartProps<TabularAnalysisData>) {
  const analysis = data.analysis as TabularAnalysisData["analysis"];
  const { chart, selectedSheet } = analysis;
  const columns = selectedSheet.columns ?? [];
  const preview = selectedSheet.previewRows ?? [];
  return (
    <section className="my-3 overflow-hidden rounded-xl border border-border bg-muted/25" aria-label={`สรุปไฟล์ ${data.filename}`}>
      <div className="flex items-start gap-3 border-b border-border bg-card px-4 py-3">
        <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 className="size-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">วิเคราะห์ {data.filename}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{selectedSheet.name} · {selectedSheet.rowCount.toLocaleString()} แถว · {selectedSheet.columnCount} คอลัมน์</p>
        </div>
      </div>
      {chart ? (
        <div className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">{chart.title}</p>
            <p className="text-[11px] text-muted-foreground">คำนวณจากข้อมูลในไฟล์</p>
          </div>
          {chart.kind === "line" ? <LineChart points={chart.points} /> : <BarChart points={chart.points} />}
        </div>
      ) : (
        <p className="px-4 py-3 text-xs leading-5 text-muted-foreground">ยังไม่พบคู่คอลัมน์ที่สร้างกราฟได้อย่างปลอดภัย แต่ยังถามให้สรุปหรือเขียนสคริปต์จากตารางได้ค่ะ</p>
      )}
      {columns.length > 0 ? (
        <div className="border-t border-border/70 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium"><Table2 className="size-3.5 text-primary" /> ตัวอย่างข้อมูล</div>
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-96 text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground"><tr>{columns.slice(0, 6).map((column) => <th key={column.name} className="whitespace-nowrap px-2.5 py-2 font-medium">{column.name}</th>)}</tr></thead>
              <tbody>{preview.slice(0, 3).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border/70">{columns.slice(0, 6).map((column, columnIndex) => <td key={column.name} className="max-w-44 truncate px-2.5 py-2" title={row[columnIndex]}>{row[columnIndex] || "–"}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : null}
      {analysis.caveats.slice(0, 2).map((caveat) => <p key={caveat} className="border-t border-border/70 px-4 py-2 text-[11px] leading-4 text-muted-foreground">{caveat}</p>)}
    </section>
  );
}
