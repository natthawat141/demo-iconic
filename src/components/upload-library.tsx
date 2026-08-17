"use client";

import { FileText, ImageIcon, RefreshCw, Table2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type LibraryFile = {
  id: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  kind: "image" | "spreadsheet" | "document";
  status: "uploaded" | "analyzed" | "failed";
  analysis: { chart?: { title?: string; points?: unknown[] } } | null;
  createdAt: string;
};

const icons = { image: ImageIcon, spreadsheet: Table2, document: FileText };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function requestLibraryFiles() {
  const response = await fetch("/api/uploads", { cache: "no-store" });
  const payload = await response.json() as { files?: LibraryFile[]; error?: string };
  if (!response.ok || !payload.files) throw new Error(payload.error ?? "โหลดคลังไฟล์ไม่สำเร็จ");
  return payload.files;
}

function FileRow({ file }: { file: LibraryFile }) {
  const Icon = icons[file.kind];
  const chart = file.analysis?.chart;
  const href = `/api/uploads/${file.id}/content`;
  return (
    <li className="flex min-h-18 items-center gap-3 px-4 py-3 sm:px-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <a href={href} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-primary hover:underline">{file.originalName}</a>
        <p className="mt-0.5 text-xs text-muted-foreground">{file.mediaType} · {formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString("th-TH")}</p>
        {chart?.title ? <p className="mt-1 truncate text-xs text-primary">มีผลวิเคราะห์: {chart.title}</p> : null}
      </div>
      <a href={href} download={file.originalName} className="shrink-0 text-xs font-medium text-primary hover:underline">ดาวน์โหลด</a>
    </li>
  );
}

export function UploadLibrary() {
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      .then((initialFiles) => { if (active) setFiles(initialFiles); })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "โหลดคลังไฟล์ไม่สำเร็จ");
      });
    return () => { active = false; };
  }, []);

  const images = files?.filter((file) => file.kind === "image") ?? [];
  const otherFiles = files?.filter((file) => file.kind !== "image") ?? [];

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-balance">คลังไฟล์ของฉัน</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">รูปและไฟล์ที่คุณแนบไว้ในแชต อยู่ใน Google Cloud Storage และเปิดดูหรือดาวน์โหลดได้จากหน้านี้</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadFiles()} disabled={loading}>
          <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} /> รีเฟรช
        </Button>
      </header>

      {error ? <p role="alert" className="mt-6 rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {files === null && !error ? <div className="mt-6 h-48 animate-pulse rounded-xl bg-muted" aria-label="กำลังโหลดคลังไฟล์" /> : null}
      {files?.length === 0 ? (
        <section className="mt-12 text-center">
          <ImageIcon className="mx-auto size-7 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">ยังไม่มีไฟล์ในคลัง</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">แนบรูป, Excel หรือเอกสารจากช่องแชต แล้วไฟล์จะปรากฏที่นี่</p>
        </section>
      ) : null}

      {images.length > 0 ? (
        <section className="mt-7" aria-labelledby="library-images-title">
          <h2 id="library-images-title" className="text-sm font-semibold">รูปภาพ</h2>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            {images.map((file) => (
              <figure key={file.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <a href={`/api/uploads/${file.id}/content`} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {/* Authenticated image bytes cannot use Next's remote image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/uploads/${file.id}/content`} alt={file.originalName} className="h-full w-full object-cover" />
                </a>
                <figcaption className="px-3 py-2.5">
                  <p className="truncate text-sm font-medium" title={file.originalName}>{file.originalName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleDateString("th-TH")}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {otherFiles.length > 0 ? (
        <section className="mt-8" aria-labelledby="library-files-title">
          <h2 id="library-files-title" className="text-sm font-semibold">เอกสารและตารางข้อมูล</h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" aria-label="เอกสารและตารางข้อมูลที่อัปโหลด">
            {otherFiles.map((file) => <FileRow key={file.id} file={file} />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
