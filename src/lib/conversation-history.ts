import "server-only";

import type { UIMessage } from "ai";

import type { ConversationDetail } from "@/db/activity-types";

export function toHistoryMessages(detail: ConversationDetail): UIMessage[] {
  const sourcesByMessage = new Map<string, ConversationDetail["sources"]>();
  for (const source of detail.sources) {
    const sources = sourcesByMessage.get(source.messageId) ?? [];
    sources.push(source);
    sourcesByMessage.set(source.messageId, sources);
  }

  return detail.messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const attachmentSummary = message.attachments
        .map((attachment) => attachment.filename ? `แนบไฟล์: ${attachment.filename}` : "แนบไฟล์")
        .join("\n");
      const text = [message.content, attachmentSummary].filter(Boolean).join("\n\n") || "แนบไฟล์";
      const sourceParts = (sourcesByMessage.get(message.id) ?? []).map((source) => ({
        type: "source-url" as const,
        sourceId: source.sourceId,
        title: source.title,
        url: source.url,
      }));

      return {
        id: message.id,
        role: message.role,
        parts: [{ type: "text" as const, text }, ...sourceParts],
      } satisfies UIMessage;
    });
}
