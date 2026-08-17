"use client";

import { useRouter } from "next/navigation";
import { BookPlus, CircleHelp, EyeOff, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KnowledgeGapDto } from "@/lib/demo-types";
import { GapStatusBadge } from "./status-badge";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function GapList({ initialGaps }: { initialGaps: KnowledgeGapDto[] }) {
  const router = useRouter();
  const [gaps, setGaps] = useState(initialGaps);
  const [workingId, setWorkingId] = useState("");
  const activeCount = gaps.filter((gap) => gap.status === "new" || gap.status === "escalated").length;

  async function convert(id: string) {
    setWorkingId(id);
    const response = await fetch(`/api/gaps/${id}/convert`, { method: "POST" });
    const data = await response.json();
    setWorkingId("");
    if (response.ok) router.push(`/knowledge/${data.knowledgeId}`);
  }

  async function dismiss(id: string) {
    setWorkingId(id);
    const response = await fetch(`/api/gaps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setWorkingId("");
    if (response.ok) {
      setGaps((current) => current.map((gap) => gap.id === id ? { ...gap, status: "dismissed" } : gap));
      router.refresh();
    }
  }

  return (
    <section className="pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{activeCount}</span> คำถามที่รอจัดการ
        </p>
        <p className="text-xs text-muted-foreground">คำถามซ้ำจะถูกรวมและเพิ่มจำนวนครั้งอัตโนมัติ</p>
      </div>

      {gaps.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-xl bg-muted px-6 text-center">
          <CircleHelp className="mb-4 size-10 text-muted-foreground" />
          <h2 className="font-bold">ยังไม่มี Knowledge Gap</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            ลองกลับไปถามน้องฟ้าด้วยคำถามที่ไม่มีในคลังความรู้ แล้วคำถามจะปรากฏที่นี่
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {gaps.map((gap) => {
            const closed = gap.status === "resolved" || gap.status === "dismissed";
            return (
              <article key={gap.id} className="border-t px-4 py-5 first:border-t-0 sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <MessageCircleQuestion className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <GapStatusBadge status={gap.status} />
                        <Badge variant="secondary">
                          ถูกถาม {gap.count} ครั้ง
                        </Badge>
                      </div>
                      <h2 className="mt-3 text-pretty font-semibold leading-7">{gap.question}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">ล่าสุด {formatDate(gap.lastAskedAt)}</p>
                    </div>
                  </div>
                  {!closed ? (
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        onClick={() => convert(gap.id)}
                        disabled={workingId === gap.id}
                        size="lg"
                        className="h-11 px-3.5"
                      >
                        <BookPlus className="size-4" />
                        {workingId === gap.id ? "กำลังเปิด..." : "เพิ่มเป็น Knowledge"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => dismiss(gap.id)}
                        disabled={workingId === gap.id}
                        variant="outline"
                        size="lg"
                        className="h-11 px-3.5 text-muted-foreground"
                      >
                        <EyeOff className="size-4" /> ปิดรายการ
                      </Button>
                    </div>
                  ) : gap.resolvedKnowledgeItemId ? (
                    <Button
                      type="button"
                      onClick={() => router.push(`/knowledge/${gap.resolvedKnowledgeItemId}`)}
                      variant="outline"
                      size="lg"
                      className="h-11 shrink-0 px-3.5"
                    >
                      เปิด Knowledge
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
