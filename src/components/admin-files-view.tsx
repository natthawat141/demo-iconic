"use client";

import {
  BarChart3,
  Check,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  HardDrive,
  ImageIcon,
  Layers,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  UserRound,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AdminFileItem = {
  id: string;
  userId: string;
  conversationId: string | null;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  objectPath: string;
  kind: "image" | "spreadsheet" | "document";
  status: "uploaded" | "analyzed" | "failed";
  analysis: Record<string, unknown> | null;
  createdAt: string | Date;
};

const iconByKind = {
  image: ImageIcon,
  spreadsheet: Table2,
  document: FileText,
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contentHref(file: AdminFileItem) {
  return `/api/uploads/${file.id}/content`;
}

function displayId(id: string) {
  return id.length > 20 ? `${id.slice(0, 12)}…${id.slice(-6)}` : id;
}

function formatThaiDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TabCategory = "all" | "image" | "spreadsheet" | "document";

interface AdminFilesViewProps {
  initialFiles: AdminFileItem[];
}

export function AdminFilesView({ initialFiles }: AdminFilesViewProps) {
  const [files, setFiles] = useState<AdminFileItem[]>(initialFiles);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TabCategory>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [activeFile, setActiveFile] = useState<AdminFileItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const reloadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/files", { cache: "no-store" });
      const data = (await response.json()) as { files?: AdminFileItem[] };
      if (response.ok && data.files) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error("Failed to refresh admin files", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = files.length;
    const images = files.filter((f) => f.kind === "image");
    const spreadsheets = files.filter((f) => f.kind === "spreadsheet");
    const documents = files.filter((f) => f.kind === "document");
    const analyzed = files.filter((f) => f.status === "analyzed");
    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

    return {
      total,
      totalBytes,
      imagesCount: images.length,
      spreadsheetsCount: spreadsheets.length,
      documentsCount: documents.length,
      analyzedCount: analyzed.length,
    };
  }, [files]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return files.filter((file) => {
      if (selectedCategory !== "all" && file.kind !== selectedCategory) {
        return false;
      }
      if (!q) return true;

      const chartTitle = (file.analysis?.chart as { title?: string } | undefined)?.title?.toLowerCase() ?? "";
      return (
        file.originalName.toLowerCase().includes(q) ||
        file.userId.toLowerCase().includes(q) ||
        file.mediaType.toLowerCase().includes(q) ||
        chartTitle.includes(q)
      );
    });
  }, [files, selectedCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <HardDrive className="size-3.5" /> CLOUD STORAGE · REPOSITORY
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
            ไฟล์และการวิเคราะห์
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            ไฟล์ทั้งหมดในระบบที่ผู้ใช้และทีมงานอัปโหลด จัดเก็บบน Google Cloud Storage พร้อมตรวจสอบ metadata, ดูพรีวิว และผลการวิเคราะห์ข้อมูล
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reloadFiles()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            รีเฟรชข้อมูล
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <section
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-label="สถิติไฟล์ในระบบ"
      >
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">ไฟล์ทั้งหมด</span>
            <Layers className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{metrics.total}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            รวม {formatBytes(metrics.totalBytes)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">รูปภาพ</span>
            <ImageIcon className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{metrics.imagesCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">ภาพถ่าย / แคปเจอร์</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">ตาราง & CSV</span>
            <Table2 className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {metrics.spreadsheetsCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Excel / CSV Workbook</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">เอกสาร PDF</span>
            <FileText className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{metrics.documentsCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">PDF / Document</p>
        </div>

        <div className="col-span-2 rounded-xl border border-border bg-card p-4 shadow-2xs sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">วิเคราะห์แล้ว</span>
            <Sparkles className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {metrics.analyzedCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">สกัดข้อมูล & กราฟ AI</p>
        </div>
      </section>

      {/* Demo Sample Files Banner */}
      <section
        className="mt-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        aria-label="ไฟล์ข้อมูลตัวอย่างสำหรับทดสอบ"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">
            ดาวน์โหลดไฟล์ตัวอย่างสำหรับทดสอบเดโม
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            มีชุดข้อมูล Operations Workbook, Sales Funnel และ Client Follow-up สำหรับทดลองอัปโหลดและสร้างกราฟวิเคราะห์
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href="/demo-data/iconic-company-operations.xlsx" download>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
              <Download className="size-3.5" /> Operations.xlsx
            </Button>
          </a>
          <a href="/demo-data/iconic-sales-funnel.csv" download>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
              <Download className="size-3.5" /> Sales funnel.csv
            </Button>
          </a>
          <a href="/demo-data/iconic-client-followup.csv" download>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
              <Download className="size-3.5" /> Client follow-up.csv
            </Button>
          </a>
        </div>
      </section>

      {/* Filter and Search Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            ทั้งหมด
            <span className="rounded-full bg-muted/30 px-1.5 py-0.2 text-[10px] opacity-80">
              {metrics.total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("image")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "image"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ImageIcon className="size-3.5" />
            รูปภาพ
            <span className="rounded-full bg-muted/30 px-1.5 py-0.2 text-[10px] opacity-80">
              {metrics.imagesCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("spreadsheet")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "spreadsheet"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Table2 className="size-3.5" />
            ตาราง & CSV
            <span className="rounded-full bg-muted/30 px-1.5 py-0.2 text-[10px] opacity-80">
              {metrics.spreadsheetsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("document")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "document"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileText className="size-3.5" />
            เอกสาร PDF
            <span className="rounded-full bg-muted/30 px-1.5 py-0.2 text-[10px] opacity-80">
              {metrics.documentsCount}
            </span>
          </button>
        </div>

        {/* Search Bar & View Mode */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[240px] flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ค้นหาชื่อไฟล์, ผู้ใช้ หรือผลวิเคราะห์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center rounded-lg border border-border bg-card p-1">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
              aria-label="แสดงแบบการ์ด"
              className="size-7"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("table")}
              aria-label="แสดงแบบตาราง"
              className="size-7"
            >
              <List className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Files Display */}
      {filteredFiles.length === 0 ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground/50" />
          <h2 className="mt-3 text-base font-semibold">ไม่พบไฟล์ที่ตรงกับเงื่อนไข</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery
              ? `ไม่พบไฟล์ที่ตรงกับคำค้นหา “${searchQuery}”`
              : "ยังไม่มีไฟล์อัปโหลดในหมวดหมู่นี้"}
          </p>
          {searchQuery && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-4"
            >
              ล้างการค้นหา
            </Button>
          )}
        </section>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <section
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="รายการไฟล์แบบการ์ด"
        >
          {filteredFiles.map((file) => {
            const Icon = iconByKind[file.kind];
            const href = contentHref(file);
            const chart = file.analysis?.chart as
              | { title?: string; points?: unknown[] }
              | undefined;
            const isPdf = file.mediaType === "application/pdf";
            const pageCount = (file.analysis as { pageCount?: number } | undefined)?.pageCount;

            return (
              <article
                key={file.id}
                className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-2xs transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                {/* Top preview thumbnail or header */}
                {file.kind === "image" ? (
                  <div
                    onClick={() => setActiveFile(file)}
                    className="relative aspect-video w-full cursor-pointer overflow-hidden bg-muted/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={href}
                      alt={file.originalName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-lg bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                        <Eye className="size-3.5" /> เปิดดูรูปภาพ
                      </span>
                    </div>
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </div>
                ) : (
                  <div
                    onClick={() => setActiveFile(file)}
                    className="flex cursor-pointer items-start justify-between border-b border-border/60 bg-muted/20 p-4 transition-colors group-hover:bg-primary/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {file.kind}
                        </span>
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                          {formatBytes(file.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    {file.status === "analyzed" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="size-2.5" /> วิเคราะห์แล้ว
                      </span>
                    )}
                  </div>
                )}

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveFile(file)}
                      className="block text-left text-sm font-semibold tracking-[-0.01em] transition-colors hover:text-primary"
                      title={file.originalName}
                    >
                      <p className="line-clamp-2">{file.originalName}</p>
                    </button>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserRound className="size-3" />
                        <span title={file.userId}>{displayId(file.userId)}</span>
                      </span>
                      <span>·</span>
                      <span>{formatThaiDate(file.createdAt)}</span>
                    </div>

                    {/* Analysis Insight Tag */}
                    {chart?.title ? (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
                        <p className="flex items-center gap-1.5 font-medium">
                          <BarChart3 className="size-3.5 shrink-0" />
                          <span className="truncate">{chart.title}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] opacity-80">
                          สร้างกราฟ AI · {chart.points?.length ?? 0} จุดข้อมูล
                        </p>
                      </div>
                    ) : isPdf && pageCount ? (
                      <div className="mt-3 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <FileText className="size-3.5 shrink-0 text-primary" />
                          <span>อ่านเอกสาร {pageCount} หน้าแล้ว</span>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveFile(file)}
                      className="h-8 gap-1.5 px-2.5 text-xs text-primary hover:bg-primary/10"
                    >
                      <Eye className="size-3.5" /> เปิดดู
                    </Button>
                    <a href={href} download={file.originalName}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5 text-xs"
                      >
                        <Download className="size-3.5" /> ดาวน์โหลด
                      </Button>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        /* TABLE / LIST VIEW */
        <section
          className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
          aria-label="รายการไฟล์แบบตาราง"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">ชื่อไฟล์และประเภท</th>
                  <th className="px-4 py-3 font-semibold">ผู้ใช้อัปโหลด</th>
                  <th className="px-4 py-3 font-semibold">ขนาด</th>
                  <th className="px-4 py-3 font-semibold">สถานะ / การวิเคราะห์</th>
                  <th className="px-4 py-3 font-semibold">วันที่อัปโหลด</th>
                  <th className="px-4 py-3 text-right font-semibold">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFiles.map((file) => {
                  const Icon = iconByKind[file.kind];
                  const href = contentHref(file);
                  const chart = file.analysis?.chart as
                    | { title?: string; points?: unknown[] }
                    | undefined;

                  return (
                    <tr key={file.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 max-w-[280px]">
                            <button
                              type="button"
                              onClick={() => setActiveFile(file)}
                              className="block truncate text-left text-sm font-medium hover:text-primary hover:underline"
                              title={file.originalName}
                            >
                              {file.originalName}
                            </button>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {file.mediaType}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          <UserRound className="size-3" />
                          <span title={file.userId}>{displayId(file.userId)}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-muted-foreground">
                        {formatBytes(file.sizeBytes)}
                      </td>

                      <td className="px-4 py-3.5">
                        {chart?.title ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            <BarChart3 className="size-3" /> {chart.title}
                          </span>
                        ) : file.status === "analyzed" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Sparkles className="size-3" /> วิเคราะห์แล้ว
                          </span>
                        ) : (
                          <span className="text-muted-foreground">อัปโหลดแล้ว</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground">
                        {formatThaiDate(file.createdAt)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveFile(file)}
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            <Eye className="size-3.5" /> เปิดดู
                          </Button>
                          <a href={href} download={file.originalName}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2 text-xs"
                            >
                              <Download className="size-3.5" /> ดาวน์โหลด
                            </Button>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Interactive Preview Modal Dialog */}
      <Dialog open={activeFile !== null} onOpenChange={(open) => !open && setActiveFile(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          {activeFile && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase text-primary">
                    {activeFile.kind}
                  </span>
                  {activeFile.status === "analyzed" && (
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      วิเคราะห์แล้ว
                    </span>
                  )}
                </div>
                <DialogTitle className="mt-1 truncate pr-8 text-lg font-bold">
                  {activeFile.originalName}
                </DialogTitle>
                <DialogDescription>
                  ตรวจสอบข้อมูลและพรีวิวไฟล์จาก Google Cloud Storage
                </DialogDescription>
              </DialogHeader>

              {/* Preview Content Container */}
              <div className="my-2 space-y-4">
                {activeFile.kind === "image" ? (
                  <div className="flex min-h-[280px] max-h-[60dvh] items-center justify-center overflow-auto rounded-xl border border-border bg-muted/40 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={contentHref(activeFile)}
                      alt={activeFile.originalName}
                      className="max-h-[55dvh] max-w-full rounded-lg object-contain shadow-sm"
                    />
                  </div>
                ) : activeFile.mediaType === "application/pdf" ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <iframe
                      title={`พรีวิว ${activeFile.originalName}`}
                      src={contentHref(activeFile)}
                      className="h-[65dvh] min-h-[420px] w-full bg-background"
                    />
                  </div>
                ) : activeFile.kind === "spreadsheet" ? (
                  <SpreadsheetAnalysisPreview file={activeFile} />
                ) : (
                  <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    <FileText className="mx-auto size-10 text-muted-foreground/60" />
                    <p className="mt-2 font-medium">ไม่สามารถเปิดพรีวิวไฟล์ประเภทนี้ในเบราว์เซอร์ได้โดยตรง</p>
                    <p className="mt-1 text-xs">คุณสามารถดาวน์โหลดไฟล์เพื่อเปิดในโปรแกรมที่รองรับได้ค่ะ</p>
                  </div>
                )}

                {/* Metadata Details Card */}
                <div className="rounded-xl border border-border bg-card p-4 text-xs">
                  <h3 className="font-semibold text-foreground">รายละเอียด Metadata</h3>
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">รหัสไฟล์ (File ID):</dt>
                      <dd className="mt-0.5 flex items-center gap-1 font-mono">
                        <span className="truncate">{activeFile.id}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeFile.id, "id")}
                          className="text-muted-foreground hover:text-foreground"
                          title="คัดลอก ID"
                        >
                          {copiedKey === "id" ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">ผู้อัปโหลด (User ID):</dt>
                      <dd className="mt-0.5 flex items-center gap-1 font-mono">
                        <span className="truncate">{activeFile.userId}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeFile.userId, "user")}
                          className="text-muted-foreground hover:text-foreground"
                          title="คัดลอก User ID"
                        >
                          {copiedKey === "user" ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">ขนาดไฟล์ (Size):</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {formatBytes(activeFile.sizeBytes)} ({activeFile.sizeBytes.toLocaleString()} bytes)
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">MIME Type:</dt>
                      <dd className="mt-0.5 font-mono text-foreground">{activeFile.mediaType}</dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">Cloud Storage Path:</dt>
                      <dd className="mt-0.5 flex items-center gap-1 font-mono text-muted-foreground">
                        <span className="truncate" title={activeFile.objectPath}>
                          {activeFile.objectPath}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeFile.objectPath, "path")}
                          className="text-muted-foreground hover:text-foreground"
                          title="คัดลอก Object Path"
                        >
                          {copiedKey === "path" ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">วันที่อัปโหลด:</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {formatThaiDate(activeFile.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFile(null)}
                >
                  ปิดหน้าต่าง
                </Button>
                <a href={contentHref(activeFile)} download={activeFile.originalName}>
                  <Button type="button" size="sm" className="gap-1.5">
                    <Download className="size-4" /> ดาวน์โหลดไฟล์
                  </Button>
                </a>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpreadsheetAnalysisPreview({ file }: { file: AdminFileItem }) {
  const analysis = file.analysis as
    | {
        chart?: { title?: string; points?: Array<{ label: string; value: number }> };
        selectedSheet?: {
          name?: string;
          rowCount?: number;
          columns?: Array<{ name: string; kind: string; numeric?: { min: number; max: number; sum: number; average: number } }>;
          previewRows?: string[][];
        };
        sheets?: Array<{ name: string }>;
      }
    | undefined;

  const chart = analysis?.chart;
  const sheet = analysis?.selectedSheet;

  return (
    <div className="space-y-4">
      {/* Chart Section */}
      {chart?.title ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <BarChart3 className="size-4" /> ผลสรุปกราฟ AI: {chart.title}
          </div>
          {chart.points && chart.points.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {chart.points.slice(0, 8).map((pt, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-2.5">
                  <p className="truncate text-[11px] text-muted-foreground" title={pt.label}>
                    {pt.label}
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-foreground">
                    {typeof pt.value === "number" ? pt.value.toLocaleString() : pt.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Sheets and Columns Structure */}
      {sheet ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="size-4 text-primary" /> ชีต: {sheet.name ?? "Sheet1"} ({sheet.rowCount ?? 0} แถว)
            </span>
            {analysis?.sheets && (
              <span className="text-muted-foreground">ทั้งหมด {analysis.sheets.length} ชีต</span>
            )}
          </div>

          {sheet.columns && sheet.columns.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sheet.columns.map((col, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-[11px]"
                >
                  <span className="font-semibold text-foreground">{col.name}</span>
                  <span className="text-[10px] text-muted-foreground">({col.kind})</span>
                </span>
              ))}
            </div>
          )}

          {/* Sample Preview Rows */}
          {sheet.previewRows && sheet.previewRows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-[11px]">
                <tbody className="divide-y divide-border">
                  {sheet.previewRows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx === 0 ? "bg-muted/40 font-semibold" : ""}>
                      {row.slice(0, 6).map((cell, cIdx) => (
                        <td key={cIdx} className="px-2.5 py-1.5 truncate max-w-[150px]">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          ยังไม่มีโครงสร้างชีตที่วิเคราะห์ไว้ล่วงหน้า คุณสามารถดาวน์โหลดไฟล์เพื่อเปิดตรวจสอบได้
        </div>
      )}
    </div>
  );
}
