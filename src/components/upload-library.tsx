"use client";

import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NongFahSaiMascot } from "@/components/nong-fah-sai-mascot";
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

type LibraryFile = {
  id: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  kind: "image" | "spreadsheet" | "document";
  status: "uploaded" | "analyzed" | "failed";
  analysis: {
    chart?: { title?: string; points?: unknown[] };
    kind?: string;
    pageCount?: number;
    extractedCharacters?: number;
    caveats?: string[];
  } | null;
  createdAt: string;
};

type FileAction = "preview" | "rename" | "delete";
type ActiveFileAction = { file: LibraryFile; action: FileAction } | null;
type TabCategory = "all" | "image" | "document" | "spreadsheet";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contentHref(file: LibraryFile) {
  return `/api/uploads/${file.id}/content`;
}

function formatRelativeDate(dateString: string) {
  const d = new Date(dateString);
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

function FileTypeIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "image") {
    return <ImageIcon className={cn("size-4 text-emerald-500", className)} />;
  }
  if (kind === "spreadsheet") {
    return <FileSpreadsheet className={cn("size-4 text-blue-500", className)} />;
  }
  return <FileText className={cn("size-4 text-amber-500", className)} />;
}

async function requestLibraryFiles() {
  const response = await fetch("/api/uploads", { cache: "no-store" });
  const payload = (await response.json()) as { files?: LibraryFile[]; error?: string };
  if (!response.ok || !payload.files) throw new Error(payload.error ?? "โหลดคลังไฟล์ไม่สำเร็จ");
  return payload.files;
}

export function UploadLibrary() {
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TabCategory>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeAction, setActiveAction] = useState<ActiveFileAction>(null);
  const [newName, setNewName] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFiles(await requestLibraryFiles());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดคลังไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestLibraryFiles()
      .then((initialFiles) => {
        if (active) setFiles(initialFiles);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "โหลดคลังไฟล์ไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, []);

  function openAction(action: FileAction, file: LibraryFile) {
    setActionError("");
    setNewName(file.originalName);
    setActiveAction({ action, file });
  }

  function closeAction() {
    if (!saving) setActiveAction(null);
  }

  async function renameFile() {
    if (!activeAction || activeAction.action !== "rename") return;
    setSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/uploads/${activeAction.file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: newName }),
      });
      const payload = (await response.json()) as { file?: { originalName?: string }; error?: string };
      if (!response.ok || !payload.file?.originalName)
        throw new Error(payload.error ?? "เปลี่ยนชื่อไฟล์ไม่สำเร็จ");
      setFiles(
        (current) =>
          current?.map((file) =>
            file.id === activeAction.file.id
              ? { ...file, originalName: payload.file!.originalName! }
              : file
          ) ?? null
      );
      setActiveAction(null);
    } catch (renameError) {
      setActionError(renameError instanceof Error ? renameError.message : "เปลี่ยนชื่อไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile() {
    if (!activeAction || activeAction.action !== "delete") return;
    setSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/uploads/${activeAction.file.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { deleted?: boolean; error?: string };
      if (!response.ok || !payload.deleted)
        throw new Error(payload.error ?? "ลบไฟล์ไม่สำเร็จ");
      setFiles((current) => current?.filter((file) => file.id !== activeAction.file.id) ?? null);
      setActiveAction(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "ลบไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    const q = searchQuery.toLowerCase().trim();
    return files.filter((file) => {
      if (selectedCategory === "image" && file.kind !== "image") return false;
      if (selectedCategory === "document" && file.kind !== "document") return false;
      if (selectedCategory === "spreadsheet" && file.kind !== "spreadsheet") return false;

      if (!q) return true;
      return (
        file.originalName.toLowerCase().includes(q) ||
        file.mediaType.toLowerCase().includes(q)
      );
    });
  }, [files, selectedCategory, searchQuery]);

  const activeFile = activeAction?.file;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Top Header matching ChatGPT Library */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Library
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            ไฟล์ที่คุณอัปโหลดไว้ในแชต ({files?.length ?? 0} รายการ)
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
            onClick={() => void loadFiles()}
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

      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Pill Tabs & View Toggle (ChatGPT style) */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
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

      {/* Loading Skeleton */}
      {files === null && !error ? (
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-muted/40" aria-label="กำลังโหลดคลังไฟล์" />
      ) : null}

      {/* Empty State */}
      {files?.length === 0 ? (
        <section className="py-20 text-center">
          <NongFahSaiMascot variant="library" className="mx-auto w-32 sm:w-36" />
          <h2 className="mt-2 text-base font-semibold text-foreground">ยังไม่มีไฟล์ในคลัง</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            แนบรูป, Excel หรือ PDF จากช่องแชต แล้วไฟล์จะปรากฏที่นี่
          </p>
        </section>
      ) : null}

      {/* Main Files Display */}
      {files && files.length > 0 && (
        filteredFiles.length === 0 ? (
          <div className="py-20 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">ไม่พบไฟล์ที่ตรงกับเงื่อนไข</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchQuery ? "ลองค้นหาด้วยคำค้นอื่น" : "ยังไม่มีไฟล์ในหมวดหมู่นี้"}
            </p>
          </div>
        ) : viewMode === "list" ? (
          /* CHATGPT LIST VIEW */
          <div className="mt-2 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Name</th>
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
                      onClick={() => openAction("preview", file)}
                    >
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

                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {formatRelativeDate(file.createdAt)}
                      </td>

                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {formatBytes(file.sizeBytes)}
                      </td>

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
                            <DropdownMenuItem onClick={() => openAction("preview", file)}>
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
                            <DropdownMenuItem onClick={() => openAction("rename", file)}>
                              <Pencil className="size-3.5" /> เปลี่ยนชื่อ
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openAction("delete", file)}
                            >
                              <Trash2 className="size-3.5" /> ลบไฟล์
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
                  onClick={() => openAction("preview", file)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-foreground/30 hover:shadow-md cursor-pointer aspect-square"
                >
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

                  <div className="mt-2.5 flex items-end justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors" title={file.originalName}>
                        {file.originalName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(file.sizeBytes)} · {formatRelativeDate(file.createdAt)}
                      </p>
                    </div>

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
                          <DropdownMenuItem onClick={() => openAction("preview", file)}>
                            <Eye className="size-3.5" /> เปิดดู
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
                          <DropdownMenuItem onClick={() => openAction("rename", file)}>
                            <Pencil className="size-3.5" /> เปลี่ยนชื่อ
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openAction("delete", file)}
                          >
                            <Trash2 className="size-3.5" /> ลบไฟล์
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Action Dialogs */}
      <Dialog
        open={activeAction !== null}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
      >
        <DialogContent
          className={
            activeAction?.action === "preview"
              ? "max-h-[94dvh] overflow-auto sm:max-w-3xl"
              : "sm:max-w-md"
          }
        >
          {activeFile && activeAction?.action === "preview" ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileTypeIcon kind={activeFile.kind} className="size-3.5" />
                  <span className="uppercase font-semibold">{activeFile.kind}</span>
                  <span>·</span>
                  <span>{formatBytes(activeFile.sizeBytes)}</span>
                </div>
                <DialogTitle className="mt-1 truncate pr-7 text-lg font-bold">
                  {activeFile.originalName}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {activeFile.mediaType}
                </DialogDescription>
              </DialogHeader>

              <div className="my-3">
                {activeFile.kind === "image" ? (
                  <div className="flex min-h-52 items-center justify-center overflow-auto rounded-xl border border-border bg-muted/40 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={contentHref(activeFile)}
                      alt={activeFile.originalName}
                      className="max-h-[65dvh] max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : activeFile.mediaType === "application/pdf" ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <iframe
                      title={`ตัวอย่าง ${activeFile.originalName}`}
                      src={contentHref(activeFile)}
                      className="h-[65dvh] min-h-80 w-full bg-background"
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

              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" size="sm" onClick={closeAction}>
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
          ) : null}

          {activeFile && activeAction?.action === "rename" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void renameFile();
              }}
            >
              <DialogHeader>
                <DialogTitle>เปลี่ยนชื่อไฟล์</DialogTitle>
                <DialogDescription>
                  เปลี่ยนชื่อที่แสดงในคลังไฟล์ของคุณ
                </DialogDescription>
              </DialogHeader>
              <label className="mt-4 block text-sm font-medium" htmlFor="library-file-name">
                ชื่อไฟล์
              </label>
              <input
                id="library-file-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={160}
                autoFocus
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {actionError ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {actionError}
                </p>
              ) : null}
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={closeAction} disabled={saving}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "บันทึกชื่อใหม่"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {activeFile && activeAction?.action === "delete" ? (
            <>
              <DialogHeader>
                <DialogTitle>ลบไฟล์นี้หรือไม่?</DialogTitle>
                <DialogDescription>
                  ไฟล์จะถูกลบออกจากคลังและ Cloud Storage อย่างถาวร
                </DialogDescription>
              </DialogHeader>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm font-medium break-all">
                {activeFile.originalName}
              </p>
              {actionError ? (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              ) : null}
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={closeAction} disabled={saving}>
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void deleteFile()}
                  disabled={saving}
                >
                  {saving ? "กำลังลบ..." : "ลบไฟล์"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
