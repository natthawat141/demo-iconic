"use client";

import { ArrowUp, LoaderCircle, Sparkles, UserRound } from "lucide-react";
import { useRef, useState } from "react";

import { MarkdownContent } from "@/components/markdown-content";
import { NongFahSaiMascot } from "@/components/nong-fah-sai-mascot";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const starters = [
  "ช่วยสรุปงาน Knowledge ที่ควรทำก่อน",
  "มี Knowledge Gap อะไรที่ควรเปลี่ยนเป็น Draft?",
  "ช่วยแนะนำวิธี review บทสนทนาในเดโมนี้",
];

type MessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function AdminAiWorkspace() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function ask(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;

    const userMessage: MessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !data.answer) {
        setError(data.error ?? "Admin AI ตอบไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      const assistantMessage: MessageItem = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการติดต่อ Admin AI");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask();
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.5rem)] max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" /> ADMIN AI WORKSPACE
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">คิดงานกับ Admin AI</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          ถามเพื่อสรุป Knowledge, หา Gap หรือเตรียมงาน review ได้ AI จะเสนอแนะเท่านั้น การอนุมัติและแก้ไขข้อมูลยังเป็นการตัดสินใจของผู้ดูแล
        </p>
      </header>

      {/* Messages Thread Section */}
      <section className="flex flex-1 flex-col py-6" aria-live="polite">
        {messages.length === 0 ? (
          <div className="my-auto text-center">
            <NongFahSaiMascot variant="avatar" className="mx-auto w-14" />
            <p className="mt-2 text-lg font-semibold">มีอะไรให้ช่วย review ไหม?</p>
            <p className="mt-1 text-xs text-muted-foreground">เลือกคำถามเริ่มต้นหรือพิมพ์ข้อความด้านล่างได้เลย</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {starters.map((starter) => (
                <Button
                  key={starter}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void ask(starter)}
                  disabled={loading}
                >
                  {starter}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "fade-in slide-in-from-bottom-1 animate-in duration-150",
                  msg.role === "user" ? "flex justify-end" : "flex items-start gap-3"
                )}
              >
                {msg.role === "assistant" && (
                  <NongFahSaiMascot
                    variant="avatar"
                    className="mt-0.5 size-8 shrink-0 rounded-full bg-muted"
                  />
                )}

                <div
                  className={cn(
                    "min-w-0 leading-relaxed",
                    msg.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-xs"
                      : "max-w-[85%] rounded-2xl border border-border bg-card p-4 shadow-2xs sm:p-5"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="size-3.5" /> Admin AI
                    </div>
                  )}

                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownContent content={msg.content} className="text-sm leading-6" />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2.5 px-1 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                <NongFahSaiMascot variant="avatar" className="size-7 shrink-0 rounded-full bg-muted" />
                <span className="flex items-center gap-1.5 font-medium">
                  <LoaderCircle className="size-3.5 animate-spin text-primary" />
                  Admin AI กำลังคิดและวิเคราะห์ข้อมูล...
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Composer Input Form matching User Chat */}
      <form
        className="relative mt-auto flex w-full flex-col pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <div
          data-slot="aui_composer-shell"
          className="flex w-full flex-col gap-1.5 rounded-[1.35rem] border border-input/80 bg-card/95 p-2.5 shadow-sm transition-[border-color,box-shadow,transform] duration-150 focus-within:-translate-y-px focus-within:border-primary/60 focus-within:shadow-md"
        >
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ถามเรื่อง Knowledge, Conversation หรือไฟล์ที่อัปโหลด..."
            className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-40 min-h-14 w-full resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none"
            rows={1}
            autoFocus
            enterKeyHint="send"
            aria-label="พิมพ์คำถามสำหรับ Admin AI"
          />

          <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span className="hidden sm:inline">AI ให้ข้อเสนอแนะ ไม่ดำเนินการแทนคุณ</span>
              <span className="sm:hidden">AI ให้ข้อเสนอแนะ</span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <TooltipIconButton
                tooltip="ส่งคำถาม"
                side="bottom"
                type="submit"
                variant="default"
                size="icon"
                className="size-9 rounded-full shadow-sm"
                disabled={loading || !question.trim()}
                aria-label="ส่งคำถาม"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </TooltipIconButton>
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          AI ไม่ดำเนินการแทนคุณ · ตรวจสอบข้อมูลสำคัญเสมอ
        </p>

        {error ? (
          <p role="alert" className="mt-2 text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
