"use client";

import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contentHref(file: AdminFileItem) {
  return `/api/uploads/${file.id}/content`;
}

function displayId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function formatRelativeDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "เมื่อสักครู่";
  if (diffHours < 24) return `${diffHours} ชม. ที่แล้ว`;
  if (diffDays === 1) return "เมื่อวาน";
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

  return d.toLocaleDateString("th-TH", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileTypeIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "image") {
    return <ImageIcon className={cn("size-4 text-emerald-500", className)} />;
  }
  if (kind === "spreadsheet") {
    return <FileSpreadsheet className={cn("size-4 text-blue-500", className)} />;
  }
  return <FileText className={cn("size-4 text-amber-500", className)} />;
}

type TabCategory = "all" | "image" | "document" | "spreadsheet";

interface AdminFilesViewProps {
  initialFiles: AdminFileItem[];
}

export function AdminFilesView({ initialFiles }: AdminFilesViewProps) {
  const [files, setFiles] = useState<AdminFileItem[]>(initialFiles);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TabCategory>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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

  // Filtered files
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return files.filter((file) => {
      if (selectedCategory === "image" && file.kind !== "image") return false;
      if (selectedCategory === "document" && file.kind !== "document") return false;
      if (selectedCategory === "spreadsheet" && file.kind !== "spreadsheet") return false;

      if (!q) return true;
      return (
        file.originalName.toLowerCase().includes(q) ||
        file.userId.toLowerCase().includes(q) ||
        file.mediaType.toLowerCase().includes(q)
      );
    });
  }, [files, selectedCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Top Header matching ChatGPT Library */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Library
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ไฟล์และเอกสารทั้งหมดในระบบ ({files.length} รายการ)
          </p>
        </div>

        {/* Right Search and Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-[220px] sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-full border-input/60 bg-muted/30 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:ring-1"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void reloadFiles()}
            disabled={loading}
            className="size-9 rounded-full text-muted-foreground hover:text-foreground"
            title="รีเฟรชไฟล์"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-full px-3.5 text-xs font-medium"
                />
              }
            >
              <span>ตัวอย่างเดโม</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                ดาวน์โหลดไฟล์ทดสอบ
              </div>
              <DropdownMenuItem
                render={
                  <a
                    href="/demo-data/iconic-company-operations.xlsx"
                    download
                    className="flex w-full items-center gap-2"
                  />
                }
              >
                <Download className="size-3.5" /> Operations.xlsx
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a
                    href="/demo-data/iconic-sales-funnel.csv"
                    download
                    className="flex w-full items-center gap-2"
                  />
                }
              >
                <Download className="size-3.5" /> Sales funnel.csv
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a
                    href="/demo-data/iconic-client-followup.csv"
                    download
                    className="flex w-full items-center gap-2"
                  />
                }
              >
                <Download className="size-3.5" /> Client follow-up.csv
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pill Tabs & View Toggle (ChatGPT Library style) */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        {/* Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "all"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("image")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "image"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Images
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("document")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "document"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Documents
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("spreadsheet")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === "spreadsheet"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Spreadsheets
          </button>
        </div>

        {/* View Switcher: Grid vs List */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("grid")}
            className="size-8 rounded-lg"
            title="Grid View"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("list")}
            className="size-8 rounded-lg"
            title="List View"
          >
            <ListIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Files Content */}
      {filteredFiles.length === 0 ? (
        <div className="py-20 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">ไม่พบไฟล์ที่ตรงกับเงื่อนไข</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery ? `ลองค้นหาด้วยคำค้นอื่น` : `ยังไม่มีไฟล์ในหมวดหมู่นี้`}
          </p>
        </div>
      ) : viewMode === "list" ? (
        /* CHATGPT LIST VIEW */
        <div className="mt-2 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/40 text-[11px] font-semibold text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="hidden py-3 px-4 font-medium sm:table-cell">Owner</th>
                <th className="py-3 px-4 font-medium">Modified</th>
                <th className="py-3 px-4 font-medium">Size</th>
                <th className="py-3 pl-4 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredFiles.map((file) => {
                const href = contentHref(file);
                return (
                  <tr
                    key={file.id}
                    className="group transition-colors hover:bg-muted/40 cursor-pointer"
                    onClick={() => setActiveFile(file)}
                  >
                    {/* Name + Thumbnail/Icon */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {file.kind === "image" ? (
                          <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={href}
                              alt={file.originalName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60">
                            <FileTypeIcon kind={file.kind} className="size-4" />
                          </div>
                        )}

                        <div className="min-w-0 max-w-[240px] sm:max-w-md">
                          <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                            {file.originalName}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {file.mediaType}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Owner / User */}
                    <td className="hidden py-3 px-4 text-muted-foreground sm:table-cell">
                      <span className="font-mono text-[11px]">{displayId(file.userId)}</span>
                    </td>

                    {/* Modified */}
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {formatRelativeDate(file.createdAt)}
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {formatBytes(file.sizeBytes)}
                    </td>

                    {/* Action Menu (...) */}
                    <td className="py-3 pl-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 rounded-lg opacity-60 group-hover:opacity-100"
                              aria-label="Actions"
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs">
                          <DropdownMenuItem onClick={() => setActiveFile(file)}>
                            <Eye className="size-3.5" /> เปิดดู (Preview)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            render={
                              <Link
                                href={`/?attachment=${file.id}`}
                                className="flex w-full items-center gap-2"
                              />
                            }
                          >
                            <MessageSquare className="size-3.5" /> คุยเกี่ยวกับไฟล์นี้
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            render={
                              <a
                                href={href}
                                download={file.originalName}
                                className="flex w-full items-center gap-2"
                              />
                            }
                          >
                            <Download className="size-3.5" /> ดาวน์โหลด
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(file.id, file.id)}
                          >
                            <Copy className="size-3.5" />
                            {copiedKey === file.id ? "คัดลอก ID แล้ว" : "คัดลอก File ID"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CHATGPT GRID VIEW */
        <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredFiles.map((file) => {
            const href = contentHref(file);
            return (
              <div
                key={file.id}
                onClick={() => setActiveFile(file)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-foreground/30 hover:shadow-md cursor-pointer aspect-square"
              >
                {/* Thumbnail / Center icon */}
                {file.kind === "image" ? (
                  <div className="relative h-full w-full overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={href}
                      alt={file.originalName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-muted/40 p-3 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-background shadow-xs ring-1 ring-border/50">
                      <FileTypeIcon kind={file.kind} className="size-6" />
                    </div>
                  </div>
                )}

                {/* Minimalist Bottom Info */}
                <div className="mt-2.5 flex items-end justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(file.sizeBytes)} · {formatRelativeDate(file.createdAt)}
                    </p>
                  </div>

                  {/* 3-dots Menu Button */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                            aria-label="File actions"
                          />
                        }
                      >
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 text-xs">
                        <DropdownMenuItem onClick={() => setActiveFile(file)}>
                          <Eye className="size-3.5" /> เปิดดู (Preview)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          render={
                            <a
                              href={href}
                              download={file.originalName}
                              className="flex w-full items-center gap-2"
                            />
                          }
                        >
                          <Download className="size-3.5" /> ดาวน์โหลด
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Clean Preview Dialog */}
      <Dialog open={activeFile !== null} onOpenChange={(open) => !open && setActiveFile(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          {activeFile && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileTypeIcon kind={activeFile.kind} className="size-3.5" />
                  <span className="uppercase font-semibold">{activeFile.kind}</span>
                  <span>·</span>
                  <span>{formatBytes(activeFile.sizeBytes)}</span>
                </div>
                <DialogTitle className="mt-1 truncate pr-8 text-lg font-bold">
                  {activeFile.originalName}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  อัปโหลดเมื่อ {formatFullDate(activeFile.createdAt)} โดย {displayId(activeFile.userId)}
                </DialogDescription>
              </DialogHeader>

              {/* Preview Content */}
              <div className="my-3">
                {activeFile.kind === "image" ? (
                  <div className="flex min-h-[260px] max-h-[60dvh] items-center justify-center overflow-auto rounded-xl border border-border bg-muted/40 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={contentHref(activeFile)}
                      alt={activeFile.originalName}
                      className="max-h-[55dvh] max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : activeFile.mediaType === "application/pdf" ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <iframe
                      title={`Preview ${activeFile.originalName}`}
                      src={contentHref(activeFile)}
                      className="h-[60dvh] min-h-[380px] w-full bg-background"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                    <FileText className="mx-auto size-8 text-muted-foreground/60" />
                    <p className="mt-2 font-medium text-foreground">{activeFile.originalName}</p>
                    <p className="mt-1">{activeFile.mediaType} ({formatBytes(activeFile.sizeBytes)})</p>
                  </div>
                )}
              </div>

              {/* Clean Footer Actions */}
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFile(null)}
                >
                  ปิด
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    render={<Link href={`/?attachment=${activeFile.id}`} />}
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                  >
                    <MessageSquare className="size-3.5" /> คุยในแชต
                  </Button>
                  <a href={contentHref(activeFile)} download={activeFile.originalName}>
                    <Button type="button" size="sm" className="gap-1.5 text-xs">
                      <Download className="size-3.5" /> ดาวน์โหลด
                    </Button>
                  </a>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
