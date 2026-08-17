"use client";

import { BrainCircuit, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Memory = {
  id: string;
  content: string;
  kind: "preference" | "project" | "fact" | "instruction";
  updatedAt: string;
  lastUsedAt: string | null;
};

const kindLabel: Record<Memory["kind"], string> = {
  preference: "ความชอบ",
  project: "โปรเจกต์",
  fact: "บริบท",
  instruction: "แนวทางตอบ",
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export function MemoryManager() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<Memory["kind"]>("fact");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/memories", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดความจำไม่สำเร็จ");
        return response.json() as Promise<{ memories: Memory[] }>;
      })
      .then((payload) => {
        if (active) setMemories(payload.memories);
      })
      .catch(() => active && setNotice("โหลดรายการความจำไม่สำเร็จ"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function addMemory() {
    const value = content.trim();
    if (!value || saving) return;
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: value, kind }),
    });
    const payload = await response.json().catch(() => ({})) as { memory?: Memory; error?: string };
    setSaving(false);
    if (!response.ok || !payload.memory) {
      setNotice(payload.error ?? "บันทึกความจำไม่สำเร็จ");
      return;
    }
    setMemories((current) => [payload.memory!, ...current.filter((memory) => memory.id !== payload.memory!.id)]);
    setContent("");
    setNotice("น้องฟ้าจะใช้ข้อมูลนี้เฉพาะเมื่อเกี่ยวข้องกับคำถามค่ะ");
  }

  async function removeMemory(id: string) {
    setNotice("");
    const response = await fetch(`/api/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("ลบความจำไม่สำเร็จ กรุณาลองใหม่");
      return;
    }
    setMemories((current) => current.filter((memory) => memory.id !== id));
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="size-5" /></span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">ความจำของฉัน</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">น้องฟ้าจะนำข้อมูลด้านล่างไปใช้ข้ามบทสนทนา เฉพาะเมื่อมีประโยชน์ต่อคำถามของคุณ</p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void addMemory(); }}
            placeholder="เช่น เรียกฉันว่า Bill และตอบให้กระชับ"
            aria-label="เพิ่มความจำ"
            maxLength={420}
          />
          <select value={kind} onChange={(event) => setKind(event.target.value as Memory["kind"])} className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/20" aria-label="ประเภทความจำ">
            {Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button type="button" onClick={() => void addMemory()} disabled={saving || content.trim().length < 3} className="shrink-0">
            {saving ? <LoaderCircle className="animate-spin" /> : <Plus />}
            <span className="hidden sm:inline">จำไว้</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">ไม่เก็บรหัสผ่าน ข้อมูลชำระเงิน เลขเอกสารราชการ ที่อยู่ละเอียด หรือข้อมูลสุขภาพ</p>
        {notice ? <p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-5 py-3 text-sm font-medium">รายการที่บันทึกไว้</div>
        {loading ? <div className="flex items-center gap-2 px-5 py-7 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />กำลังโหลด...</div> : null}
        {!loading && memories.length === 0 ? <p className="px-5 py-8 text-sm leading-6 text-muted-foreground">ยังไม่มีความจำ เพิ่มสิ่งที่อยากให้น้องฟ้าคำนึงถึงเมื่อคุยครั้งถัดไปได้เลย</p> : null}
        {!loading && memories.map((memory) => (
          <div key={memory.id} className="flex items-start gap-3 border-b px-5 py-4 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-6">{memory.content}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{kindLabel[memory.kind]}</Badge><span>อัปเดต {dateLabel(memory.updatedAt)}</span>{memory.lastUsedAt ? <span>ใช้งานล่าสุด {dateLabel(memory.lastUsedAt)}</span> : null}</div>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => void removeMemory(memory.id)} aria-label="ลบความจำ"><Trash2 className="size-4 text-muted-foreground" /></Button>
          </div>
        ))}
      </div>
    </section>
  );
}
