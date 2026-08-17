import "server-only";

import type { UIMessage } from "ai";

import { activityStorage } from "@/db/activity-storage";
import type { ConversationDetail, UploadedFile } from "@/db/activity-types";
import type { TabularAnalysisData } from "@/lib/demo-types";

type FileResolver = (id: string) => Promise<UploadedFile | null>;
type MessagePart = UIMessage["parts"][number];

export async function toHistoryMessages(
  detail: ConversationDetail,
  resolveFile: FileResolver = (id) => activityStorage.getUploadedFile(id),
): Promise<UIMessage[]> {
  const sourcesByMessage = new Map<string, ConversationDetail["sources"]>();
  for (const source of detail.sources) {
    const sources = sourcesByMessage.get(source.messageId) ?? [];
    sources.push(source);
    sourcesByMessage.set(source.messageId, sources);
  }

  const fileIds = [...new Set(detail.messages.flatMap((message) => message.attachments)
    .map((attachment) => attachment.uploadedFileId)
    .filter((id): id is string => Boolean(id)))];
  const resolvedFiles = await Promise.all(fileIds.map(resolveFile));
  const filesById = new Map(resolvedFiles
    .filter((file): file is UploadedFile => file?.userId === detail.conversation.userId)
    .map((file) => [file.id, file]));
  let pendingAnalysisParts: MessagePart[] = [];

  const history = detail.messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const fileParts: MessagePart[] = [];
      const unresolvedAttachmentSummary: string[] = [];

      for (const attachment of message.attachments) {
        const file = attachment.uploadedFileId
          ? filesById.get(attachment.uploadedFileId)
          : null;
        if (!file) {
          unresolvedAttachmentSummary.push(attachment.filename ? `แนบไฟล์: ${attachment.filename}` : "แนบไฟล์");
          continue;
        }
        fileParts.push({
          type: "file",
          filename: file.originalName,
          mediaType: file.mediaType,
          url: file.id,
        });
        if (file.kind === "spreadsheet" && file.analysis) {
          pendingAnalysisParts.push({
            type: "data-tabular-analysis",
            data: {
              fileId: file.id,
              filename: file.originalName,
              analysis: file.analysis,
            } as TabularAnalysisData,
          } as MessagePart);
        }
      }

      const text = [message.content, unresolvedAttachmentSummary.join("\n")]
        .filter(Boolean)
        .join("\n\n");
      const textParts: MessagePart[] = text
        ? [{ type: "text", text }]
        : fileParts.length === 0
          ? [{ type: "text", text: "แนบไฟล์" }]
          : [];
      const sourceParts: MessagePart[] = (sourcesByMessage.get(message.id) ?? []).map((source) => ({
        type: "source-url" as const,
        sourceId: source.sourceId,
        title: source.title,
        url: source.url,
      }));

      const analysisParts = message.role === "assistant" ? pendingAnalysisParts : [];
      if (message.role === "assistant") pendingAnalysisParts = [];

      return {
        id: message.id,
        role: message.role,
        parts: [...analysisParts, ...textParts, ...fileParts, ...sourceParts],
      } satisfies UIMessage;
    });

  if (pendingAnalysisParts.length > 0 && history.length > 0) {
    history[history.length - 1]!.parts.push(...pendingAnalysisParts);
  }
  return history;
}
