export type DemoUser = {
  id: string;
  displayName: string;
  createdAt: Date;
  lastSeenAt: Date;
};

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredAttachment = {
  filename: string | null;
  mediaType: string;
  uploadedFileId: string | null;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: StoredAttachment[];
  createdAt: Date;
};

export type AnswerSource = {
  messageId: string;
  sourceId: string;
  title: string;
  url: string;
};

export type UploadedFile = {
  id: string;
  userId: string;
  conversationId: string | null;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  objectPath: string;
  kind: "image" | "spreadsheet" | "document";
  status: "uploaded" | "analyzed" | "failed";
  analysis: Record<string, unknown> | null;
  createdAt: Date;
};

export type ConversationDetail = {
  conversation: Conversation;
  messages: ConversationMessage[];
  sources: AnswerSource[];
};

export type NewUploadedFile = Omit<UploadedFile, "createdAt">;
