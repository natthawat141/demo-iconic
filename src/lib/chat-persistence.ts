import "server-only";

import type { UIMessage } from "ai";

import { activityStorage } from "@/db/activity-storage";
import type { AnswerSource, ConversationMessage, StoredAttachment } from "@/db/activity-types";

export const DEMO_USER_COOKIE = "iconic_demo_user";
const MAX_IDENTIFIER_LENGTH = 128;
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDemoIdentifier(value: string | undefined) {
  return Boolean(value && /^[A-Za-z0-9_-]{12,128}$/.test(value));
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

function messageContent(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function messageAttachments(message: UIMessage): StoredAttachment[] {
  return message.parts
    .filter((part) => part.type === "file")
    .map((part) => ({
      filename: part.filename ?? null,
      mediaType: part.mediaType,
      // Never store a data URL. Uploaded file metadata links the attachment later.
      uploadedFileId: UPLOAD_ID_PATTERN.test(part.url) ? part.url : null,
    }));
}

function toStoredMessage(message: UIMessage, conversationId: string): ConversationMessage {
  return {
    id: message.id.slice(0, MAX_IDENTIFIER_LENGTH),
    conversationId,
    role: message.role,
    content: messageContent(message),
    attachments: messageAttachments(message),
    createdAt: new Date(),
  };
}

function titleFromMessages(messages: UIMessage[]) {
  const firstQuestion = messages.find((message) => message.role === "user");
  const text = firstQuestion ? messageContent(firstQuestion) : "บทสนทนาใหม่";
  return (text || "บทสนทนาใหม่").slice(0, 120);
}

function sessionCookie(userId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${DEMO_USER_COOKIE}=${encodeURIComponent(userId)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export type ChatPersistence = {
  userId: string;
  conversationId: string;
  setCookie: string | null;
  persistAssistantResponse(message: UIMessage): Promise<void>;
};

export async function getDemoUserForRequest(request: Request) {
  const cookieUser = cookieValue(request, DEMO_USER_COOKIE);
  const userId = isValidDemoIdentifier(cookieUser) ? cookieUser! : `demo_${crypto.randomUUID()}`;
  await activityStorage.ensureUser(userId);
  return {
    userId,
    setCookie: userId === cookieUser ? null : sessionCookie(userId),
  };
}

export async function beginChatPersistence(
  request: Request,
  requestedConversationId: unknown,
  messages: UIMessage[],
): Promise<ChatPersistence> {
  const { userId, setCookie } = await getDemoUserForRequest(request);

  let conversationId = typeof requestedConversationId === "string" && isValidDemoIdentifier(requestedConversationId)
    ? requestedConversationId
    : crypto.randomUUID();
  const existing = await activityStorage.getConversation(conversationId);
  if (existing && existing.conversation.userId !== userId) {
    conversationId = crypto.randomUUID();
  }
  await activityStorage.ensureConversation(conversationId, userId, titleFromMessages(messages));

  const incoming = messages
    .filter((message) => message.role !== "system")
    .map((message) => toStoredMessage(message, conversationId));
  await activityStorage.saveMessages(incoming);

  return {
    userId,
    conversationId,
    setCookie,
    async persistAssistantResponse(message) {
      const stored = toStoredMessage(message, conversationId);
      await activityStorage.saveMessages([stored]);
      const sources: AnswerSource[] = message.parts
        .filter((part) => part.type === "source-url")
        .map((part) => ({
          messageId: stored.id,
          sourceId: part.sourceId,
          title: part.title ?? "Knowledge source",
          url: part.url,
        }));
      await activityStorage.saveAnswerSources(sources);
    },
  };
}

export function withDemoSessionCookie(response: Response, setCookie: string | null) {
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}
