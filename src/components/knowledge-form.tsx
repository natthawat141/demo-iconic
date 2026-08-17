"use client";

import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, CheckCircle2, Save } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { KnowledgeItemDto, KnowledgeStatus } from "@/lib/demo-types";
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

export function KnowledgeForm({ item }: { item?: KnowledgeItemDto }) {
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(item));
  const [status, setStatus] = useState<KnowledgeStatus>(item?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isNew = !item;

  const approvalMissing = useMemo(() => {
    const required: (keyof FormState)[] = [
      "title", "summary", "content", "category", "sourceLabel", "ownerName",
    ];
    return required.filter((key) => form[key].trim().length === 0);
  }, [form]);

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const payload = {
      ...form,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      reviewDate: form.reviewDate || null,
    };
    const response = await fetch(isNew ? "/api/knowledge" : `/api/knowledge/${item.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
          : "เปลี่ยนกลับเป็น Draft แล้ว",
    );
    router.refresh();
  }

  const fieldClass =
    "mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <Link href="/knowledge" className="mb-2 inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> กลับไปคลังความรู้
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-balance text-2xl font-bold tracking-[-0.02em]">{isNew ? "เพิ่ม Knowledge" : "แก้ไข Knowledge"}</h1>
            <KnowledgeStatusBadge status={status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            <Save className="size-4" /> {saving ? "กำลังบันทึก..." : "บันทึก Draft"}
          </button>
          {status !== "approved" ? (
            <button
              type="button"
              onClick={() => changeStatus("approved")}
              disabled={saving || approvalMissing.length > 0}
              aria-describedby="approval-help"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.49_0.17_24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" /> อนุมัติให้ AI ใช้
            </button>
          ) : (
            <button
              type="button"
              onClick={() => changeStatus("archived")}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/85 disabled:opacity-60"
            >
              <Archive className="size-4" /> Archive
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-5" aria-label="แบบฟอร์ม Knowledge">
          <label className="block text-sm font-semibold">ชื่อ Knowledge
            <input className={fieldClass} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="เช่น เมื่อลูกค้าขอปรึกษาคู่สมรสก่อน" required />
          </label>
          <label className="block text-sm font-semibold">สรุปสั้น ๆ
            <input className={fieldClass} value={form.summary} onChange={(event) => update("summary", event.target.value)} placeholder="บอกว่าน้องฟ้าจะใช้เนื้อหานี้ตอบเรื่องอะไร" required />
          </label>
          <label className="block text-sm font-semibold">เนื้อหาที่อนุมัติ
            <textarea className={`${fieldClass} min-h-56 resize-y py-3 leading-7`} value={form.content} onChange={(event) => update("content", event.target.value)} placeholder="เขียนแนวทาง ขั้นตอน และข้อจำกัดให้ชัดเจน" required />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">หมวดหมู่
              <input className={fieldClass} value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="การติดตามลูกค้า" required />
            </label>
            <label className="block text-sm font-semibold">Tags
              <input className={fieldClass} value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="follow-up, objection" />
            </label>
            <label className="block text-sm font-semibold">แหล่งที่มา
              <input className={fieldClass} value={form.sourceLabel} onChange={(event) => update("sourceLabel", event.target.value)} placeholder="ICONIC Sales Playbook" required />
            </label>
            <label className="block text-sm font-semibold">เจ้าของความรู้
              <input className={fieldClass} value={form.ownerName} onChange={(event) => update("ownerName", event.target.value)} placeholder="Founder Office" required />
            </label>
            <label className="block text-sm font-semibold">วันที่ทบทวนครั้งถัดไป
              <input type="date" className={fieldClass} value={form.reviewDate} onChange={(event) => update("reviewDate", event.target.value)} />
            </label>
          </div>
        </form>

        <aside className="h-fit rounded-xl bg-muted p-5 lg:sticky lg:top-6">
          <p className="text-sm font-bold">ตัวอย่าง Source ที่ทีมจะเห็น</p>
          <div className="mt-4 rounded-xl bg-background p-4">
            <p className="text-xs font-semibold text-[oklch(0.43_0.11_235)]">แหล่งข้อมูลที่ใช้ตอบ</p>
            <p className="mt-1 text-sm font-semibold">{form.title || "ชื่อ Knowledge"}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{form.sourceLabel || "แหล่งที่มา"} · {form.category || "หมวดหมู่"}</p>
          </div>
          <p id="approval-help" className="mt-4 text-xs leading-5 text-muted-foreground">
            {approvalMissing.length > 0
              ? "กรอกชื่อ สรุป เนื้อหา หมวดหมู่ แหล่งที่มา และเจ้าของให้ครบก่อนอนุมัติ"
              : "พร้อมอนุมัติ เมื่อกดแล้วน้องฟ้าจะอัปเดตดัชนีค้นหาโดยอัตโนมัติ"}
          </p>
          <p role={message.includes("ไม่") ? "alert" : "status"} className="mt-3 min-h-6 text-sm font-medium text-primary">{message}</p>
        </aside>
      </div>
    </div>
  );
}

