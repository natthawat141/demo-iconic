"use client";

import {
  AuiConfig,
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  useAssistantDataUI,
  type AttachmentAdapter,
  type CompleteAttachment,
  type PendingAttachment,
  type DataMessagePartProps,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { BarChart3, CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Thread } from "@/components/thread";
import { Button } from "@/components/ui/button";
import type { KnowledgeStateData, TabularAnalysisData } from "@/lib/demo-types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type UploadResponse = {
  upload: {
    id: string;
    filename: string;
    mediaType: string;
    kind: "image" | "spreadsheet" | "document";
    analysis: TabularAnalysisData["analysis"] | null;
    prompt: string;
  };
};

async function uploadAttachment(file: File) {
  const data = new FormData();
  data.append("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: data });
  const payload = await response.json() as UploadResponse | { error?: string };
  if (!response.ok || !("upload" in payload)) {
    throw new Error("error" in payload && payload.error ? payload.error : "อัปโหลดไฟล์ไม่สำเร็จ");
  }
  return payload.upload;
}

class DemoImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
  override accept = "image/jpeg,image/png,image/webp,image/gif";

  override async add({ file }: { file: File }) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("รูปต้องมีขนาดไม่เกิน 5 MB");
    }
    return super.add({ file });
  }

  override async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    await uploadAttachment(attachment.file);
    return super.send(attachment);
  }
}

class DemoDocumentAttachmentAdapter implements AttachmentAdapter {
  accept = ".csv,.xlsx,.xls,.pdf,.docx";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    if (file.size > 15 * 1024 * 1024) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 15 MB");
    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const upload = await uploadAttachment(attachment.file);
    return {
      ...attachment,
      status: { type: "complete" },
      content: [{
        type: "file",
        filename: upload.filename,
        data: upload.id,
        mimeType: upload.mediaType,
        sourceType: "id",
      }],
    };
  }

  async remove() {
    // The demo retains uploaded files for the Admin Files view.
  }
}

const attachmentAdapter = new CompositeAttachmentAdapter([
  new DemoImageAttachmentAdapter(),
  new DemoDocumentAttachmentAdapter(),
]);

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

function TabularAnalysisCard({ data }: DataMessagePartProps<TabularAnalysisData>) {
  const analysis = data.analysis as TabularAnalysisData["analysis"];
  const chart = analysis.chart;
  const maxValue = Math.max(...(chart?.points.map((point) => point.value) ?? [1]), 1);
  return (
    <section className="my-3 overflow-hidden rounded-xl border border-border bg-muted/35" aria-label={`สรุปไฟล์ ${data.filename}`}>
      <div className="flex items-start gap-3 border-b border-border bg-card px-4 py-3">
        <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 className="size-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">วิเคราะห์ {data.filename}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{analysis.selectedSheet.name} · {analysis.selectedSheet.rowCount.toLocaleString()} แถว · {analysis.selectedSheet.columnCount} คอลัมน์</p>
        </div>
      </div>
      {chart ? (
        <div className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">{chart.title}</p>
            <p className="text-[11px] text-muted-foreground">สรุปผลรวมจากข้อมูลที่อ่านได้</p>
          </div>
          <div className="flex h-36 items-end gap-2 border-b border-border/80 pb-1" role="img" aria-label={chart.title}>
            {chart.points.map((point) => (
              <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted-foreground">{point.value.toLocaleString()}</span>
                <span className="w-full min-w-3 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(7, (point.value / maxValue) * 100)}%` }} />
                <span className="max-w-full truncate text-[10px] text-muted-foreground" title={point.label}>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs leading-5 text-muted-foreground">ไม่สร้างกราฟอัตโนมัติ เพราะยังไม่พบคู่คอลัมน์ที่สรุปได้อย่างปลอดภัย</p>
      )}
      {analysis.caveats.slice(0, 2).map((caveat) => <p key={caveat} className="border-t border-border/70 px-4 py-2 text-[11px] leading-4 text-muted-foreground">{caveat}</p>)}
    </section>
  );
}

function FileAnalysisDataRenderer() {
  useAssistantDataUI({ name: "tabular-analysis", render: TabularAnalysisCard });
  return null;
}

type AssistantProps = {
  conversationId?: string;
  initialMessages: UIMessage[];
};

export const Assistant = ({ conversationId, initialMessages }: AssistantProps) => {
  const [newConversationId] = useState(() => crypto.randomUUID());
  const activeConversationId = conversationId ?? newConversationId;
  const transport = useMemo(() => new AssistantChatTransport({
    api: "/api/chat",
    body: { conversationId: activeConversationId },
  }), [activeConversationId]);
  const chat = useChat({
    id: activeConversationId,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
    onFinish: () => {
      window.history.replaceState(null, "", `/?conversation=${encodeURIComponent(activeConversationId)}`);
      window.dispatchEvent(new Event("iconic:conversation-updated"));
    },
  });
  const runtime = useAISDKRuntime(chat, {
    adapters: { attachments: attachmentAdapter },
  });
  return (
    <AssistantRuntimeProvider runtime={runtime} config={AuiConfig({})}>
      <KnowledgeDataRenderer />
      <FileAnalysisDataRenderer />
      <div className="h-[calc(100dvh-3.75rem)]">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
