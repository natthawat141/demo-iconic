"use client";

import { ArrowUp, BotMessageSquare, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const starters = [
  "ช่วยสรุปงาน Knowledge ที่ควรทำก่อน",
  "มี Knowledge Gap อะไรที่ควรเปลี่ยนเป็น Draft?",
  "ช่วยแนะนำวิธี review บทสนทนาในเดโมนี้",
];

export function AdminAiWorkspace() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;
    setQuestion(trimmed);
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed }),
    });
    const data = await response.json() as { answer?: string; error?: string };
    setLoading(false);
    if (!response.ok || !data.answer) {
      setError(data.error ?? "Admin AI ตอบไม่สำเร็จ กรุณาลองใหม่");
      return;
    }
    setAnswer(data.answer);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.5rem)] max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="size-3.5" /> ADMIN AI</div>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">คิดงานกับ Admin AI</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">ถามเพื่อสรุป Knowledge, หา Gap หรือเตรียมงาน review ได้ AI จะเสนอแนะเท่านั้น การอนุมัติและแก้ไขข้อมูลยังเป็นการตัดสินใจของผู้ดูแล</p>
      </header>

      <section className="flex flex-1 flex-col py-6" aria-live="polite">
        {answer ? (
          <div className="max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><BotMessageSquare className="size-4 text-primary" /> Admin AI</div>
            <p className="whitespace-pre-wrap text-sm leading-6">{answer}</p>
          </div>
        ) : (
          <div className="my-auto text-center">
            <BotMessageSquare className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-lg font-semibold">มีอะไรให้ช่วย review ไหม?</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {starters.map((starter) => <Button key={starter} type="button" variant="outline" size="sm" onClick={() => ask(starter)}>{starter}</Button>)}
            </div>
          </div>
        )}
      </section>

      <form className="rounded-2xl border border-input bg-card p-3 shadow-sm focus-within:ring-2 focus-within:ring-ring" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="ถามเรื่อง Knowledge, Conversation หรือไฟล์ที่อัปโหลด..." className="min-h-20 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground" aria-label="คำถามสำหรับ Admin AI" />
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-muted-foreground">AI ไม่ดำเนินการแทนคุณ</p>
          <Button type="submit" size="icon" disabled={loading || !question.trim()} aria-label="ส่งคำถาม">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
        {error ? <p className="px-2 pt-2 text-xs text-destructive">{error}</p> : null}
      </form>
    </div>
  );
}
