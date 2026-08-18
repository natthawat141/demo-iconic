import { describe, expect, it } from "vitest";

import type { ConversationDetail, UploadedFile } from "@/db/activity-types";
import { toHistoryMessages } from "@/lib/conversation-history";

const now = new Date("2026-08-18T00:00:00.000Z");
const fileId = "f4f04d88-2011-4ff7-9be3-ef3e9d06ae88";

function conversationDetail(): ConversationDetail {
  return {
    conversation: {
      id: "conversation_123456",
      userId: "demo_user_123456",
      title: "วิเคราะห์ยอดขาย",
      createdAt: now,
      updatedAt: now,
    },
    messages: [
      {
        id: "message_user_123456",
        conversationId: "conversation_123456",
        role: "user",
        content: "ช่วยวิเคราะห์ไฟล์นี้",
        attachments: [{ filename: "sales.csv", mediaType: "text/csv", uploadedFileId: fileId }],
        createdAt: now,
      },
      {
        id: "message_assistant_123456",
        conversationId: "conversation_123456",
        role: "assistant",
        content: "ยอดขายรวมเพิ่มขึ้น",
        attachments: [],
        createdAt: now,
      },
    ],
    sources: [{
      messageId: "message_assistant_123456",
      sourceId: "source-1",
      title: "แหล่งข้อมูล",
      url: "/knowledge/source-1",
    }],
    feedback: [],
  };
}

function uploadedFile(): UploadedFile {
  return {
    id: fileId,
    userId: "demo_user_123456",
    conversationId: "conversation_123456",
    originalName: "sales.csv",
    mediaType: "text/csv",
    sizeBytes: 120,
    objectPath: "demo_user_123456/file/sales.csv",
    kind: "spreadsheet",
    status: "analyzed",
    analysis: {
      selectedSheet: { name: "CSV", rowCount: 2, columnCount: 2 },
      chart: { kind: "bar", title: "ยอดขาย", points: [{ label: "A", value: 10 }] },
      caveats: [],
    },
    createdAt: now,
  };
}

describe("conversation history", () => {
  it("restores the uploaded file and its analysis card before the assistant answer", async () => {
    const messages = await toHistoryMessages(conversationDetail(), async () => uploadedFile());

    expect(messages[0]?.parts).toContainEqual(expect.objectContaining({
      type: "file",
      filename: "sales.csv",
      mediaType: "text/csv",
      url: fileId,
    }));
    expect(messages[1]?.parts[0]).toMatchObject({
      type: "data-tabular-analysis",
      data: { fileId, filename: "sales.csv" },
    });
    expect(messages[1]?.parts).toContainEqual(expect.objectContaining({
      type: "source-url",
      sourceId: "source-1",
    }));
  });

  it("keeps a readable attachment summary when the file has been deleted", async () => {
    const messages = await toHistoryMessages(conversationDetail(), async () => null);

    expect(messages[0]?.parts).toEqual([{
      type: "text",
      text: "ช่วยวิเคราะห์ไฟล์นี้\n\nแนบไฟล์: sales.csv",
    }]);
    expect(messages.flatMap((message) => message.parts).some((part) => part.type === "data-tabular-analysis")).toBe(false);
  });

  it("does not fabricate an attachment label for an empty assistant response", async () => {
    const detail = conversationDetail();
    detail.messages[0]!.attachments = [];
    detail.messages[1]!.content = "";
    detail.sources = [];

    const messages = await toHistoryMessages(detail, async () => uploadedFile());

    expect(messages[1]?.parts).toEqual([]);
  });
});
