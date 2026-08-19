"use client";

import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  Heading2,
  Heading3,
  ImageIcon,
  List as ListIcon,
  ListOrdered,
  LoaderCircle,
  Plus,
  Save,
  Sparkles,
  Table as TableIcon,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeItemDto, KnowledgeStatus } from "@/lib/demo-types";
import { cn } from "@/lib/utils";
import { KnowledgeStatusBadge } from "./status-badge";

type FormState = {
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string;
  sourceLabel: string;
  ownerName: string;
  reviewDate: string;
};

type AttachedFile = {
  id: string;
  filename: string;
  mediaType: string;
  kind: "image" | "spreadsheet" | "document";
  sizeBytes?: number;
  extractedText?: string;
  extractedSummary?: string;
};

const emptyForm: FormState = {
  title: "",
  summary: "",
  content: "",
  category: "",
  tags: "",
  sourceLabel: "",
  ownerName: "",
  reviewDate: "",
};

function toForm(item?: KnowledgeItemDto): FormState {
  if (!item) return emptyForm;
  return {
    title: item.title,
    summary: item.summary,
    content: item.content,
    category: item.category,
    tags: item.tags.join(", "),
    sourceLabel: item.sourceLabel,
    ownerName: item.ownerName,
    reviewDate: item.reviewDate?.slice(0, 10) ?? "",
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(kind: string, mediaType: string) {
  if (kind === "image") return ImageIcon;
  if (kind === "spreadsheet" || mediaType.includes("csv") || mediaType.includes("sheet"))
    return FileSpreadsheet;
  return FileText;
}

export function KnowledgeForm({ item }: { item?: KnowledgeItemDto }) {
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(item));
  const [status, setStatus] = useState<KnowledgeStatus>(item?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [lastExtracted, setLastExtracted] = useState<{
    filename: string;
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !item;

  const approvalMissing = useMemo(() => {
    const required: (keyof FormState)[] = [
      "title",
      "summary",
      "content",
      "category",
      "sourceLabel",
      "ownerName",
    ];
    return required.filter((key) => form[key].trim().length === 0);
  }, [form]);

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function insertFormatting(prefix: string, suffix = "") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = form.content;
    const selected = current.slice(start, end) || "ข้อความ";
    const next =
      current.slice(0, start) +
      prefix +
      selected +
      suffix +
      current.slice(end);
    update("content", next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      );
    }, 0);
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError("");
    setMessage("");

    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: data });
      const payload = (await response.json()) as {
        upload?: {
          id: string;
          filename: string;
          mediaType: string;
          kind: "image" | "spreadsheet" | "document";
          analysis?: Record<string, unknown>;
          prompt?: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.upload) {
        throw new Error(payload.error ?? "อัปโหลดไฟล์ไม่สำเร็จ");
      }

      const up = payload.upload;
      let extractedMarkdown = "";

      // Format extracted markdown text based on file type
      if (up.kind === "spreadsheet" && up.analysis) {
        const selected = (up.analysis as { selectedSheet?: { name?: string; rowCount?: number; columns?: Array<{ name: string; kind: string }>; previewRows?: string[][] } }).selectedSheet;
        const cols = selected?.columns?.map((c) => c.name) ?? [];
        const rows = selected?.previewRows ?? [];

        let tableMd = "";
        if (cols.length > 0) {
          tableMd =
            `| ${cols.join(" | ")} |\n` +
            `| ${cols.map(() => "---").join(" | ")} |\n` +
            rows.slice(0, 10).map((r) => `| ${r.map((c) => String(c).replace(/\|/g, "/")).join(" | ")} |`).join("\n");
        }

        extractedMarkdown = [
          `### ข้อมูลตาราง: ${up.filename}`,
          selected?.name ? `ชีต: **${selected.name}** (${selected.rowCount ?? 0} แถว)` : "",
          tableMd,
        ]
          .filter(Boolean)
          .join("\n\n");
      } else if (up.mediaType === "application/pdf" && up.analysis) {
        const pdf = up.analysis as { pageCount?: number; extractedText?: string };
        extractedMarkdown = [
          `### ข้อมูลจากเอกสาร: ${up.filename} (${pdf.pageCount ?? 1} หน้า)`,
          pdf.extractedText ? pdf.extractedText : "ไม่พบข้อความที่เลือกอ่านได้ใน PDF",
        ].join("\n\n");
      } else {
        extractedMarkdown = `### ไฟล์แนบ: ${up.filename}\n${up.prompt ?? ""}`;
      }

      const attached: AttachedFile = {
        id: up.id,
        filename: up.filename,
        mediaType: up.mediaType,
        kind: up.kind,
        sizeBytes: file.size,
        extractedText: extractedMarkdown,
      };

      setAttachedFiles((prev) => [...prev, attached]);

      // Smart auto-fill empty form fields
      const cleanStem = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      const updates: Partial<FormState> = {};

      if (!form.title.trim()) updates.title = cleanStem;
      if (!form.sourceLabel.trim()) updates.sourceLabel = `เอกสารแนบ: ${file.name}`;
      if (!form.category.trim())
        updates.category =
          up.kind === "spreadsheet" ? "ข้อมูลและสถิติ" : "เอกสารและระเบียบการ";
      if (!form.ownerName.trim()) updates.ownerName = "Team Knowledge Admin";
      if (!form.summary.trim())
        updates.summary = `คู่มือและข้อกำหนดที่สกัดจากไฟล์ ${file.name}`;

      // If content is empty, directly fill the extracted text
      if (!form.content.trim()) {
        updates.content = extractedMarkdown;
        setMessage(`สกัดเนื้อหาจาก ${file.name} และกรอกข้อมูลลงในฟอร์มเรียบร้อยแล้ว`);
      } else {
        // If content already exists, prompt user
        setLastExtracted({ filename: file.name, text: extractedMarkdown });
        setMessage(`อัปโหลด ${file.name} สำเร็จ (คุณสามารถเลือกแทรกต่อท้ายหรือแทนที่ข้อความเดิมได้)`);
      }

      setForm((curr) => ({ ...curr, ...updates }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function appendExtractedText(text: string) {
    setForm((curr) => ({
      ...curr,
      content: curr.content ? `${curr.content}\n\n---\n\n${text}` : text,
    }));
    setLastExtracted(null);
    setMessage("แทรกเนื้อหาต่อท้ายเรียบร้อยแล้ว");
  }

  function replaceExtractedText(text: string) {
    setForm((curr) => ({ ...curr, content: text }));
    setLastExtracted(null);
    setMessage("แทนที่เนื้อหาด้วยข้อมูลจากไฟล์เรียบร้อยแล้ว");
  }

  function removeAttachment(id: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const payload = {
      ...form,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      reviewDate: form.reviewDate || null,
    };
    const response = await fetch(
      isNew ? "/api/knowledge" : `/api/knowledge/${item.id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลอีกครั้ง");
      return null;
    }
    setMessage("บันทึก Draft แล้ว");
    if (isNew) {
      router.push(`/knowledge/${data.id}`);
      return data.id as string;
    }
    router.refresh();
    return item.id;
  }

  async function changeStatus(nextStatus: KnowledgeStatus) {
    const id = await save();
    if (!id) return;
    setSaving(true);
    const response = await fetch(`/api/knowledge/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    setStatus(nextStatus);
    setMessage(
      nextStatus === "approved"
        ? "อนุมัติและอัปเดตดัชนีค้นหาแล้ว"
        : nextStatus === "archived"
          ? "Archive แล้ว น้องฟ้าจะไม่นำรายการนี้ไปตอบ"
          : "เปลี่ยนกลับเป็น Draft แล้ว"
    );
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <Button
            render={<Link href="/knowledge" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="size-4" /> กลับไปคลังความรู้
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-balance text-2xl font-bold tracking-[-0.02em]">
              {isNew ? "เพิ่ม Knowledge" : "แก้ไข Knowledge"}
            </h1>
            <KnowledgeStatusBadge status={status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            variant="outline"
            size="lg"
            className="h-11 px-4"
          >
            <Save className="size-4" />{" "}
            {saving ? "กำลังบันทึก..." : "บันทึก Draft"}
          </Button>
          {status !== "approved" ? (
            <Button
              type="button"
              onClick={() => changeStatus("approved")}
              disabled={saving || approvalMissing.length > 0}
              aria-describedby="approval-help"
              size="lg"
              className="h-11 px-4"
            >
              <CheckCircle2 className="size-4" /> อนุมัติให้ AI ใช้
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => changeStatus("archived")}
              disabled={saving}
              variant="outline"
              size="lg"
              className="h-11 px-4"
            >
              <Archive className="size-4" /> Archive
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main Form */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-6"
          aria-label="แบบฟอร์ม Knowledge"
        >
          {/* File Upload Zone */}
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 transition-colors hover:border-primary/50">
            <div className="flex flex-col items-center justify-center text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {uploading ? (
                  <LoaderCircle className="size-6 animate-spin" />
                ) : (
                  <UploadCloud className="size-6" />
                )}
              </span>
              <p className="mt-3 text-sm font-semibold">
                แนบไฟล์ PDF, Excel, CSV, Word หรือรูปภาพ
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                ระบบจะอัปโหลดไปยัง Cloud Storage พร้อมสกัดข้อความ/ตารางเพื่อนำมาสร้างเป็นเนื้อหา Knowledge ได้โดยอัตโนมัติ
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.docx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                id="knowledge-file-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <FileUp className="size-4" />
                {uploading ? "กำลังอัปโหลดและสกัดข้อมูล..." : "เลือกไฟล์จากเครื่อง"}
              </Button>

              {uploadError && (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {uploadError}
                </p>
              )}
            </div>

            {/* Prompt banner when content already exists and new file uploaded */}
            {lastExtracted && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  <p className="font-semibold text-primary">
                    สกัดข้อมูลจาก {lastExtracted.filename} เรียบร้อยแล้ว
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    ต้องการแทรกข้อความนี้ต่อท้าย หรือแทนที่เนื้อหาเดิม?
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => appendExtractedText(lastExtracted.text)}
                  >
                    <Plus className="size-3.5" /> แทรกต่อท้าย
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => replaceExtractedText(lastExtracted.text)}
                  >
                    แทนที่ทั้งหมด
                  </Button>
                </div>
              </div>
            )}

            {/* Attached Files List */}
            {attachedFiles.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground">
                  ไฟล์ที่แนบในรายการนี้ ({attachedFiles.length})
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {attachedFiles.map((file) => {
                    const Icon = fileIcon(file.kind, file.mediaType);
                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-2xs"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium" title={file.filename}>
                              {file.filename}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {file.sizeBytes ? formatBytes(file.sizeBytes) : file.mediaType}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {file.extractedText && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="แทรกข้อความลงในช่องเนื้อหา"
                              onClick={() => appendExtractedText(file.extractedText!)}
                            >
                              <Plus className="size-3.5 text-primary" />
                            </Button>
                          )}
                          <a
                            href={`/api/uploads/${file.id}/content`}
                            target="_blank"
                            rel="noreferrer"
                            title="เปิดดูไฟล์"
                          >
                            <Button type="button" variant="ghost" size="icon-sm">
                              <Eye className="size-3.5" />
                            </Button>
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="ลบไฟล์แนบ"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeAttachment(file.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <label className="block text-sm font-semibold">
            ชื่อ Knowledge
            <Input
              className="mt-1.5 h-11"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="เช่น เมื่อลูกค้าขอปรึกษาคู่สมรสก่อน หรือ ระเบียบการเบิกจ่ายค่าเดินทาง"
              required
            />
          </label>

          <label className="block text-sm font-semibold">
            สรุปสั้น ๆ
            <Input
              className="mt-1.5 h-11"
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              placeholder="บอกว่าน้องฟ้าจะใช้เนื้อหานี้ตอบเรื่องอะไร"
              required
            />
          </label>

          {/* Content Field with Editor & Preview Tabs and Toolbar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold" htmlFor="knowledge-content">
                เนื้อหาที่อนุมัติ
              </label>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorTab("edit")}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors",
                    editorTab === "edit"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  แก้ไขเนื้อหา
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("preview")}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors",
                    editorTab === "preview"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ดูตัวอย่างแสดงผล
                </button>
              </div>
            </div>

            {editorTab === "edit" ? (
              <div className="overflow-hidden rounded-xl border border-input focus-within:ring-2 focus-within:ring-ring">
                {/* Editor Toolbar */}
                <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => insertFormatting("## ")}
                    title="หัวข้อ H2"
                  >
                    <Heading2 className="size-3.5" /> หัวข้อใหญ่
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => insertFormatting("### ")}
                    title="หัวข้อ H3"
                  >
                    <Heading3 className="size-3.5" /> หัวข้อย่อย
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => insertFormatting("**", "**")}
                    title="ตัวหนา"
                  >
                    <span className="font-bold">B</span> ตัวหนา
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => insertFormatting("* ")}
                    title="รายการหัวข้อย่อย"
                  >
                    <ListIcon className="size-3.5" /> รายการ
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => insertFormatting("1. ")}
                    title="ลำดับตัวเลข"
                  >
                    <ListOrdered className="size-3.5" /> ลำดับ
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      insertFormatting(
                        "| หัวข้อ 1 | หัวข้อ 2 |\n| --- | --- |\n| ข้อมูล A | ข้อมูล B |"
                      )
                    }
                    title="แทรกตาราง"
                  >
                    <TableIcon className="size-3.5" /> ตาราง
                  </Button>
                </div>

                <Textarea
                  ref={textareaRef}
                  id="knowledge-content"
                  className="min-h-64 rounded-none border-0 py-3 leading-7 shadow-none focus-visible:ring-0"
                  value={form.content}
                  onChange={(event) => update("content", event.target.value)}
                  placeholder="เขียนแนวทาง ขั้นตอน เงื่อนไข หรือแนบไฟล์ด้านบนเพื่อสกัดข้อมูลใส่ลงในนี้โดยอัตโนมัติ"
                  required
                />
              </div>
            ) : (
              <div className="min-h-64 rounded-xl border border-border bg-card p-5">
                {form.content.trim() ? (
                  <MarkdownContent content={form.content} />
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    ยังไม่มีเนื้อหา พิมพ์หรือแนบไฟล์เพื่อดูตัวอย่างแสดงผล
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              หมวดหมู่
              <Input
                className="mt-1.5 h-11"
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
                placeholder="การติดตามลูกค้า / ระเบียบการเบิกจ่าย"
                required
              />
            </label>

            <label className="block text-sm font-semibold">
              Tags
              <Input
                className="mt-1.5 h-11"
                value={form.tags}
                onChange={(event) => update("tags", event.target.value)}
                placeholder="follow-up, objection, finance"
              />
            </label>

            <label className="block text-sm font-semibold">
              แหล่งที่มา
              <Input
                className="mt-1.5 h-11"
                value={form.sourceLabel}
                onChange={(event) => update("sourceLabel", event.target.value)}
                placeholder="ICONIC Sales Playbook / คู่มือบริษัท 2026"
                required
              />
            </label>

            <label className="block text-sm font-semibold">
              เจ้าของความรู้
              <Input
                className="mt-1.5 h-11"
                value={form.ownerName}
                onChange={(event) => update("ownerName", event.target.value)}
                placeholder="Founder Office / HR & Finance"
                required
              />
            </label>

            <label className="block text-sm font-semibold">
              วันที่ทบทวนครั้งถัดไป
              <Input
                type="date"
                className="mt-1.5 h-11"
                value={form.reviewDate}
                onChange={(event) => update("reviewDate", event.target.value)}
              />
            </label>
          </div>
        </form>

        {/* Right Sidebar Preview */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-2xs lg:sticky lg:top-6">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> LIVE PREVIEW
          </div>
          <p className="mt-1 text-sm font-bold">ตัวอย่าง Source Card ที่ทีมจะเห็น</p>

          <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary">แหล่งข้อมูลที่ใช้ตอบ</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {form.title || "ชื่อ Knowledge"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {form.sourceLabel || "แหล่งที่มา"} · {form.category || "หมวดหมู่"}
            </p>
          </div>

          {attachedFiles.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs">
              <p className="font-semibold text-muted-foreground">
                แนบเอกสาร {attachedFiles.length} ไฟล์
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {attachedFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-1.5 truncate">
                    <span>•</span>
                    <span className="truncate">{f.filename}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p id="approval-help" className="mt-4 text-xs leading-5 text-muted-foreground">
            {approvalMissing.length > 0
              ? "กรอกชื่อ สรุป เนื้อหา หมวดหมู่ แหล่งที่มา และเจ้าของให้ครบก่อนอนุมัติ"
              : "พร้อมอนุมัติ เมื่อกดแล้วน้องฟ้าจะอัปเดตดัชนีค้นหาและ Chunk เนื้อหาอัตโนมัติ"}
          </p>

          {message && (
            <p
              role={message.includes("ไม่") ? "alert" : "status"}
              className={cn(
                "mt-3 rounded-lg p-2.5 text-xs font-medium",
                message.includes("ไม่")
                  ? "border border-destructive/30 bg-destructive/10 text-destructive"
                  : "border border-primary/30 bg-primary/10 text-primary"
              )}
            >
              {message}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
