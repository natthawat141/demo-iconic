"use client";

import {
  AuiConfig,
  AssistantRuntimeProvider,
  Suggestions,
  useAssistantDataUI,
  type DataMessagePartProps,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Thread } from "@/components/thread";
import type { KnowledgeStateData } from "@/lib/demo-types";

function KnowledgeState({ data }: DataMessagePartProps<KnowledgeStateData>) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const insufficient = data.state === "insufficient";

  async function escalate() {
    if (!data.gapId || sent) return;
    setSending(true);
    const response = await fetch(`/api/gaps/${data.gapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "escalated" }),
    });
    setSending(false);
    if (response.ok) setSent(true);
  }

  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
        insufficient
          ? "bg-[oklch(0.96_0.04_75)] text-[oklch(0.32_0.07_75)]"
          : "bg-[oklch(0.95_0.035_150)] text-[oklch(0.30_0.08_150)]"
      }`}
    >
      <span className="flex items-center gap-2 font-semibold">
        {insufficient ? (
          <ShieldAlert className="size-4" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        )}
        {data.label}
      </span>
      {insufficient ? (
        <button
          type="button"
          onClick={escalate}
          disabled={sending || sent}
          className="flex min-h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-70"
        >
          {sent ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <Send className="size-3.5" />
          )}
          {sent
            ? "ส่งให้หัวหน้าทีมแล้ว"
            : sending
              ? "กำลังส่ง..."
              : "ส่งให้หัวหน้าทีม"}
        </button>
      ) : null}
    </div>
  );
}

function KnowledgeDataRenderer() {
  useAssistantDataUI({
    name: "knowledge-state",
    render: KnowledgeState,
  });
  return null;
}

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });
  const config = AuiConfig({
    suggestions: Suggestions([
      {
        title: "รับมือข้อกังวล",
        label: "ลูกค้าขอปรึกษาคู่สมรสก่อน",
        prompt: "ลูกค้าบอกว่าขอปรึกษาคู่สมรสก่อน ควรตอบอย่างไร?",
      },
      {
        title: "วางแผนติดตาม",
        label: "หลังนำเสนอแผน",
        prompt: "หลังนำเสนอแผนแล้ว ควรติดตามลูกค้าอย่างไร?",
      },
      {
        title: "ทดสอบ Knowledge Gap",
        label: "คำถามที่ยังไม่มีข้อมูล",
        prompt: "ลูกค้ารายนี้ควรเลือกกรมธรรม์ของบริษัท A หรือ B?",
      },
    ]),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <KnowledgeDataRenderer />
      <div className="h-[calc(100dvh-4rem)] lg:h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
