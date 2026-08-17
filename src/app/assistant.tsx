"use client";

import {
  AuiConfig,
  AssistantRuntimeProvider,
  SimpleImageAttachmentAdapter,
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
import { Button } from "@/components/ui/button";
import type { KnowledgeStateData } from "@/lib/demo-types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

class DemoImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
  override accept = "image/jpeg,image/png,image/webp,image/gif";

  override async add({ file }: { file: File }) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("รูปต้องมีขนาดไม่เกิน 5 MB");
    }
    return super.add({ file });
  }
}

const imageAttachmentAdapter = new DemoImageAttachmentAdapter();

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
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ring-1 ${
      insufficient
        ? "bg-[oklch(0.96_0.04_75)] text-[oklch(0.32_0.07_75)] ring-[oklch(0.84_0.08_75)] dark:bg-[oklch(0.28_0.05_75)] dark:text-[oklch(0.82_0.1_75)] dark:ring-[oklch(0.4_0.07_75)]"
        : "bg-[oklch(0.95_0.035_150)] text-[oklch(0.30_0.08_150)] ring-[oklch(0.83_0.07_150)] dark:bg-[oklch(0.27_0.045_150)] dark:text-[oklch(0.82_0.09_150)] dark:ring-[oklch(0.39_0.07_150)]"
    }`}>
      <span className="flex items-center gap-2 font-semibold">
        {insufficient ? (
          <ShieldAlert className="size-4" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        )}
        {data.label}
      </span>
      {insufficient ? (
        <Button
          type="button"
          onClick={escalate}
          disabled={sending || sent}
          size="sm"
          className="h-9 px-3"
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
        </Button>
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
    adapters: { attachments: imageAttachmentAdapter },
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
      {
        title: "ดูภาพรวมเป็นกราฟ",
        label: "Knowledge by category",
        prompt: "ช่วยสรุปภาพรวม Knowledge ของทีมเป็นกราฟให้ดูหน่อย",
      },
    ]),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <KnowledgeDataRenderer />
      <div className="h-[calc(100dvh-3.75rem)]">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
