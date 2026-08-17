"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpenText, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import type { KnowledgeItemDto, KnowledgeStatus } from "@/lib/demo-types";
import { KnowledgeStatusBadge } from "./status-badge";

const statusOptions: { value: "all" | KnowledgeStatus; label: string }[] = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));
}

export function KnowledgeList({ items }: { items: KnowledgeItemDto[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | KnowledgeStatus>("all");
  const [category, setCategory] = useState("all");
  const deferredQuery = useDeferredValue(query.toLocaleLowerCase("th"));
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort(),
    [items],
  );
  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        const haystack = `${item.title} ${item.summary} ${item.category} ${item.ownerName} ${item.tags.join(" ")}`.toLocaleLowerCase("th");
        return (
          haystack.includes(deferredQuery) &&
          (status === "all" || item.status === status) &&
          (category === "all" || item.category === category)
        );
      }),
    [category, deferredQuery, items, status],
  );

  return (
    <section className="pt-6" aria-label="รายการ Knowledge">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">ค้นหา Knowledge</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อ เนื้อหา หมวดหมู่ หรือแท็ก"
            className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="กรองตามสถานะ"
          className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="กรองตามหมวดหมู่"
          className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">ทุกหมวดหมู่</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border">
        <div className="hidden grid-cols-[minmax(280px,1.6fr)_minmax(150px,.7fr)_130px_110px] gap-4 bg-muted px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
          <span>Knowledge</span><span>เจ้าของ</span><span>สถานะ</span><span>อัปเดต</span>
        </div>
        {visibleItems.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <BookOpenText className="mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">ยังไม่พบ Knowledge ที่ตรงกับตัวกรอง</p>
            <p className="mt-1 text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหรือเลือกทุกสถานะ</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <Link
              key={item.id}
              href={`/knowledge/${item.id}`}
              className="grid gap-3 border-t px-4 py-4 first:border-t-0 transition-colors hover:bg-muted/70 md:grid-cols-[minmax(280px,1.6fr)_minmax(150px,.7fr)_130px_110px] md:items-center md:gap-4"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{item.title}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                </span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">{item.summary}</span>
                <span className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground md:hidden">{item.category}</span>
              </span>
              <span className="text-sm text-muted-foreground">{item.ownerName}</span>
              <KnowledgeStatusBadge status={item.status} />
              <span className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</span>
            </Link>
          ))
        )}
      </div>
      <p role="status" className="mt-3 text-xs text-muted-foreground">แสดง {visibleItems.length} จาก {items.length} รายการ</p>
    </section>
  );
}

