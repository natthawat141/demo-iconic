"use client";

import { Download, Eye, FileText, ImageIcon, MoreHorizontal, Pencil, RefreshCw, Table2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type LibraryFile = {
  id: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  kind: "image" | "spreadsheet" | "document";
  status: "uploaded" | "analyzed" | "failed";
  analysis: { chart?: { title?: string; points?: unknown[] }; kind?: string; pageCount?: number; extractedCharacters?: number; caveats?: string[] } | null;
  createdAt: string;
};

type FileAction = "preview" | "rename" | "delete";
type ActiveFileAction = { file: LibraryFile; action: FileAction } | null;

const icons = { image: ImageIcon, spreadsheet: Table2, document: FileText };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function contentHref(file: LibraryFile) {
  return `/api/uploads/${file.id}/content`;
}

function formatAnalysis(file: LibraryFile) {
  if (file.analysis?.chart?.title) return `มีผลวิเคราะห์: ${file.analysis.chart.title}`;
  if (file.analysis?.kind === "pdf") {
    const count = file.analysis.extractedCharacters?.toLocaleString("th-TH") ?? "0";
    return `อ่าน PDF แล้ว ${file.analysis.pageCount ?? 0} หน้า · ${count} ตัวอักษร`;
  }
  return null;
}

async function requestLibraryFiles() {
  const response = await fetch("/api/uploads", { cache: "no-store" });
  const payload = await response.json() as { files?: LibraryFile[]; error?: string };
  if (!response.ok || !payload.files) throw new Error(payload.error ?? "โหลดคลังไฟล์ไม่สำเร็จ");
  return payload.files;
}

function FileActions({ file, onAction }: { file: LibraryFile; onAction: (action: FileAction, file: LibraryFile) => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`จัดการ ${file.originalName}`} />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-36">
      <DropdownMenuItem onClick={() => onAction("preview", file)}><Eye className="size-3.5" /> เปิดดู</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAction("rename", file)}><Pencil className="size-3.5" /> เปลี่ยนชื่อ</DropdownMenuItem>
      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction("delete", file)}><Trash2 className="size-3.5" /> ลบไฟล์</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function FileRow({ file, onAction }: { file: LibraryFile; onAction: (action: FileAction, file: LibraryFile) => void }) {
  const Icon = icons[file.kind];
  const analysis = formatAnalysis(file);
  return <li className="flex min-h-18 items-center gap-3 px-4 py-3 sm:px-5">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
    <div className="min-w-0 flex-1">
      <button type="button" onClick={() => onAction("preview", file)} className="block max-w-full truncate text-left text-sm font-medium hover:text-primary hover:underline">{file.originalName}</button>
      <p className="mt-0.5 text-xs text-muted-foreground">{file.mediaType} · {formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString("th-TH")}</p>
      {analysis ? <p className="mt-1 truncate text-xs text-primary">{analysis}</p> : null}
    </div>
    <a href={contentHref(file)} download={file.originalName} className="hidden shrink-0 text-xs font-medium text-primary hover:underline sm:inline">ดาวน์โหลด</a>
    <FileActions file={file} onAction={onAction} />
  </li>;
}

function FilePreview({ file }: { file: LibraryFile }) {
  const href = contentHref(file);
  if (file.kind === "image") return <div className="flex min-h-52 items-center justify-center overflow-auto rounded-lg bg-muted/60 p-3">
    {/* Authenticated image bytes cannot use Next's remote image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={href} alt={file.originalName} className="max-h-[68dvh] max-w-full rounded-md object-contain" />
  </div>;
  if (file.mediaType === "application/pdf") return <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
    <iframe title={`ตัวอย่าง ${file.originalName}`} src={href} className="h-[68dvh] min-h-80 w-full bg-background" />
  </div>;
  return <p className="rounded-lg bg-muted/55 px-3 py-4 text-sm leading-6 text-muted-foreground">เปิดดูไฟล์ชนิดนี้ในเบราว์เซอร์ไม่ได้โดยตรง แต่ดาวน์โหลดไปเปิดในโปรแกรมที่รองรับได้ค่ะ</p>;
}

export function UploadLibrary() {
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveFileAction>(null);
  const [newName, setNewName] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true); setError("");
    try { setFiles(await requestLibraryFiles()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "โหลดคลังไฟล์ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void requestLibraryFiles().then((initialFiles) => { if (active) setFiles(initialFiles); }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "โหลดคลังไฟล์ไม่สำเร็จ");
    });
    return () => { active = false; };
  }, []);

  function openAction(action: FileAction, file: LibraryFile) {
    setActionError(""); setNewName(file.originalName); setActiveAction({ action, file });
  }
  function closeAction() { if (!saving) setActiveAction(null); }

  async function renameFile() {
    if (!activeAction || activeAction.action !== "rename") return;
    setSaving(true); setActionError("");
    try {
      const response = await fetch(`/api/uploads/${activeAction.file.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalName: newName }) });
      const payload = await response.json() as { file?: { originalName?: string }; error?: string };
      if (!response.ok || !payload.file?.originalName) throw new Error(payload.error ?? "เปลี่ยนชื่อไฟล์ไม่สำเร็จ");
      setFiles((current) => current?.map((file) => file.id === activeAction.file.id ? { ...file, originalName: payload.file!.originalName! } : file) ?? null);
      setActiveAction(null);
    } catch (renameError) { setActionError(renameError instanceof Error ? renameError.message : "เปลี่ยนชื่อไฟล์ไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function deleteFile() {
    if (!activeAction || activeAction.action !== "delete") return;
    setSaving(true); setActionError("");
    try {
      const response = await fetch(`/api/uploads/${activeAction.file.id}`, { method: "DELETE" });
      const payload = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !payload.deleted) throw new Error(payload.error ?? "ลบไฟล์ไม่สำเร็จ");
      setFiles((current) => current?.filter((file) => file.id !== activeAction.file.id) ?? null);
      setActiveAction(null);
    } catch (deleteError) { setActionError(deleteError instanceof Error ? deleteError.message : "ลบไฟล์ไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  const images = files?.filter((file) => file.kind === "image") ?? [];
  const otherFiles = files?.filter((file) => file.kind !== "image") ?? [];
  const activeFile = activeAction?.file;
  return <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:py-8">
    <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-[-0.03em] text-balance">คลังไฟล์ของฉัน</h1><p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">รูปและไฟล์ที่คุณแนบไว้ในแชต เปิดดูแบบ private ได้จากหน้านี้ และลบได้เมื่อไม่ต้องใช้งานแล้ว</p></div>
      <Button type="button" variant="outline" size="sm" onClick={() => void loadFiles()} disabled={loading}><RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} /> รีเฟรช</Button>
    </header>
    {error ? <p role="alert" className="mt-6 rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
    <section className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="ไฟล์ข้อมูลตัวอย่าง">
      <div><p className="text-sm font-medium">ลองวิเคราะห์ข้อมูลตัวอย่าง</p><p className="mt-0.5 text-xs text-muted-foreground">Operations workbook มีข้อมูลเบิกจ่าย, onboarding, โครงการ และ sales pipeline — ดาวน์โหลดแล้วแนบในแชตเพื่อดูสรุป ตาราง กราฟ และขอสคริปต์ต่อได้</p></div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a href="/demo-data/iconic-company-operations.xlsx" download><Button type="button" variant="outline" size="sm"><Download className="size-3.5" /> Operations workbook</Button></a>
        <a href="/demo-data/iconic-sales-funnel.csv" download><Button type="button" variant="outline" size="sm"><Download className="size-3.5" /> Sales funnel</Button></a>
        <a href="/demo-data/iconic-client-followup.csv" download><Button type="button" variant="outline" size="sm"><Download className="size-3.5" /> Client follow-up</Button></a>
      </div>
    </section>
    {files === null && !error ? <div className="mt-6 h-48 animate-pulse rounded-xl bg-muted" aria-label="กำลังโหลดคลังไฟล์" /> : null}
    {files?.length === 0 ? <section className="mt-12 text-center"><ImageIcon className="mx-auto size-7 text-muted-foreground" /><h2 className="mt-3 text-base font-semibold">ยังไม่มีไฟล์ในคลัง</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">แนบรูป, Excel หรือ PDF จากช่องแชต แล้วไฟล์จะปรากฏที่นี่</p></section> : null}
    {images.length > 0 ? <section className="mt-7" aria-labelledby="library-images-title">
      <h2 id="library-images-title" className="text-sm font-semibold">รูปภาพ</h2>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">{images.map((file) => <figure key={file.id} className="group overflow-hidden rounded-xl border border-border bg-card">
        <button type="button" onClick={() => openAction("preview", file)} className="block aspect-square w-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {/* Authenticated image bytes cannot use Next's remote image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={contentHref(file)} alt={file.originalName} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
        </button>
        <figcaption className="flex items-center gap-1 px-2.5 py-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium" title={file.originalName}>{file.originalName}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{formatBytes(file.sizeBytes)}</p></div><FileActions file={file} onAction={openAction} /></figcaption>
      </figure>)}</div>
    </section> : null}
    {otherFiles.length > 0 ? <section className="mt-8" aria-labelledby="library-files-title"><h2 id="library-files-title" className="text-sm font-semibold">เอกสารและตารางข้อมูล</h2><ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" aria-label="เอกสารและตารางข้อมูลที่อัปโหลด">{otherFiles.map((file) => <FileRow key={file.id} file={file} onAction={openAction} />)}</ul></section> : null}
    <Dialog open={activeAction !== null} onOpenChange={(open) => { if (!open) closeAction(); }}>
      <DialogContent className={activeAction?.action === "preview" ? "max-h-[94dvh] overflow-auto sm:max-w-4xl" : "sm:max-w-md"}>
        {activeFile && activeAction?.action === "preview" ? <><DialogHeader><DialogTitle className="truncate pr-7">{activeFile.originalName}</DialogTitle><DialogDescription>เปิดดูไฟล์แบบ private เฉพาะ session นี้</DialogDescription></DialogHeader><FilePreview file={activeFile} /><DialogFooter><a href={contentHref(activeFile)} download={activeFile.originalName}><Button type="button" variant="outline"><Download className="size-4" /> ดาวน์โหลด</Button></a></DialogFooter></> : null}
        {activeFile && activeAction?.action === "rename" ? <form onSubmit={(event) => { event.preventDefault(); void renameFile(); }}><DialogHeader><DialogTitle>เปลี่ยนชื่อไฟล์</DialogTitle><DialogDescription>เปลี่ยนเฉพาะชื่อที่แสดงในคลัง โดยไฟล์ private เดิมยังคงปลอดภัย</DialogDescription></DialogHeader><label className="mt-4 block text-sm font-medium" htmlFor="library-file-name">ชื่อไฟล์</label><input id="library-file-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={160} autoFocus className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />{actionError ? <p role="alert" className="mt-3 text-sm text-destructive">{actionError}</p> : null}<DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={closeAction} disabled={saving}>ยกเลิก</Button><Button type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกชื่อใหม่"}</Button></DialogFooter></form> : null}
        {activeFile && activeAction?.action === "delete" ? <><DialogHeader><DialogTitle>ลบไฟล์นี้หรือไม่?</DialogTitle><DialogDescription>ไฟล์จะถูกลบจากคลังและ Cloud Storage อย่างถาวร การลบจะไม่ลบข้อความในแชตเดิม</DialogDescription></DialogHeader><p className="rounded-lg bg-muted px-3 py-2 text-sm font-medium break-all">{activeFile.originalName}</p>{actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}<DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={closeAction} disabled={saving}>ยกเลิก</Button><Button type="button" variant="destructive" onClick={() => void deleteFile()} disabled={saving}>{saving ? "กำลังลบ..." : "ลบไฟล์"}</Button></DialogFooter></> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
