import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";

import { activityStorage } from "@/db/activity-storage";
import {
  beginChatPersistence,
  withDemoSessionCookie,
  type ChatPersistence,
} from "@/lib/chat-persistence";
import { ambiguousContextReply, classifyChatIntent, conversationalReply } from "@/lib/chat-intent";
import { pdfPrompt, spreadsheetPrompt } from "@/lib/file-uploads";
import {
  getKnowledgeOverview,
  recordKnowledgeGap,
  retrieveKnowledge,
  searchKnowledge,
  type RetrievedKnowledge,
} from "@/lib/knowledge";
import { getTavilyApiKey, searchWeb, type WebSearchResult } from "@/lib/web-search";

function latestQuestion(messages: UIMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return (
    latest?.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim() ?? ""
  );
}

function previousUserContext(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user");
  const previous = userMessages.at(-2);
  return previous
    ?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim() ?? "";
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_DOCUMENT_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_IMAGE_DATA_URL_LENGTH = 7_100_000;

function latestUserFiles(messages: UIMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.parts.filter((part) => part.type === "file") ?? [];
}

function isFilePart(part: UIMessage["parts"][number]): part is Extract<UIMessage["parts"][number], { type: "file" }> {
  return part.type === "file";
}

function latestUserImages(messages: UIMessage[]) {
  return latestUserFiles(messages).filter((part) => ALLOWED_IMAGE_TYPES.has(part.mediaType));
}

function latestUserDocuments(messages: UIMessage[]) {
  return latestUserFiles(messages).filter((part) => !ALLOWED_IMAGE_TYPES.has(part.mediaType));
}

function validateImages(messages: UIMessage[]) {
  const files = latestUserFiles(messages);
  const images = files.filter((part) => ALLOWED_IMAGE_TYPES.has(part.mediaType));
  const documents = files.filter((part) => !ALLOWED_IMAGE_TYPES.has(part.mediaType));
  if (files.length > 3) return "แนบไฟล์ได้ไม่เกิน 3 รายการต่อข้อความ";
  for (const image of images) {
    if (!ALLOWED_IMAGE_TYPES.has(image.mediaType)) {
      return "รองรับเฉพาะรูป JPEG, PNG, WebP และ GIF";
    }
    if (!image.url.startsWith("data:image/")) {
      return "รูปที่แนบต้องเป็นไฟล์จากเครื่องในรอบเดโมนี้";
    }
    if (image.url.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return "รูปแต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MB";
    }
  }
  for (const document of documents) {
    if (!ALLOWED_DOCUMENT_TYPES.has(document.mediaType) || !uploadIdPattern.test(document.url)) {
      return "ไฟล์เอกสารต้องอัปโหลดผ่านช่องแนบไฟล์ของระบบ";
    }
  }
  return null;
}

type UploadedFileContext = {
  id: string;
  filename: string;
  mediaType: string;
  kind: "image" | "spreadsheet" | "document";
  analysis: Record<string, unknown> | null;
};

const uploadIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function prepareModelMessages(
  messages: UIMessage[],
  userId: string,
  conversationId: string,
) {
  const ids = [...new Set(messages.flatMap((message) => message.parts)
    .filter(isFilePart)
    .filter((part) => !ALLOWED_IMAGE_TYPES.has(part.mediaType))
    .map((part) => part.url)
    .filter((url) => uploadIdPattern.test(url)))];
  const resolved = await Promise.all(ids.map(async (id) => {
    const file = await activityStorage.getUploadedFile(id);
    // A user can delete an older attachment while keeping the chat history.
    // Do not make that old thread impossible to continue, and never disclose
    // whether an arbitrary ID belongs to another user.
    if (!file || file.userId !== userId) return null;
    return {
      id: file.id,
      filename: file.originalName,
      mediaType: file.mediaType,
      kind: file.kind,
      analysis: file.analysis,
    } satisfies UploadedFileContext;
  }));
  await activityStorage.linkUploadedFilesToConversation(ids, userId, conversationId);
  const uploadedFiles = resolved.filter((file): file is UploadedFileContext => file !== null);
  const byId = new Map(uploadedFiles.map((file) => [file.id, file]));
  const modelMessages = messages.map((message) => ({
    ...message,
    parts: message.parts.flatMap((part) => {
      if (part.type !== "file" || ALLOWED_IMAGE_TYPES.has(part.mediaType)) return [part];
      const file = byId.get(part.url);
      if (!file) return [{ type: "text" as const, text: `ไฟล์ที่เคยแนบ${part.filename ? ` (${part.filename})` : ""} ไม่อยู่ในคลังแล้ว จึงไม่ใช้ไฟล์นั้นประกอบคำตอบนี้` }];
      const text = file.kind === "spreadsheet" && file.analysis
        ? spreadsheetPrompt(file.filename, file.analysis as unknown as Parameters<typeof spreadsheetPrompt>[1])
        : file.mediaType === "application/pdf" && file.analysis
          ? pdfPrompt(file.filename, file.analysis as unknown as Parameters<typeof pdfPrompt>[1])
          : `ผู้ใช้แนบไฟล์ ${file.filename} (${file.mediaType}) แล้ว ขณะนี้ระบบจัดเก็บไฟล์เรียบร้อย แต่ยังไม่มีการสกัดเนื้อหาเอกสารสำหรับเดโมนี้`;
      return [{ type: "text" as const, text }];
    }),
  })) as UIMessage[];
  return { modelMessages, uploadedFiles };
}

function writeFileAnalyses(
  writer: { write: (chunk: UIMessageChunk) => void },
  files: UploadedFileContext[],
) {
  for (const file of files) {
    if (file.kind !== "spreadsheet" || !file.analysis) continue;
    writer.write({
      type: "data-tabular-analysis",
      data: { fileId: file.id, filename: file.filename, analysis: file.analysis },
    } as UIMessageChunk);
  }
}

function writeText(writer: { write: (chunk: UIMessageChunk) => void }, text: string) {
  const id = crypto.randomUUID();
  // Custom UI streams do not create a start chunk automatically. Sending it
  // lets AI SDK give the browser the exact same assistant-message ID that we
  // persist, which also makes per-answer feedback addressable.
  writer.write({ type: "start" });
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

function writeSources(
  writer: { write: (chunk: UIMessageChunk) => void },
  sources: RetrievedKnowledge[],
) {
  const unique = new Map(sources.map((source) => [source.item.id, source]));
  for (const { item } of unique.values()) {
    writer.write({
      type: "source-url",
      sourceId: item.id,
      url: `/knowledge/${item.id}`,
      title: `${item.title} · ${item.category}`,
    });
  }
}

function writeWebSources(
  writer: { write: (chunk: UIMessageChunk) => void },
  sources: WebSearchResult[],
) {
  const unique = new Map(sources.map((source) => [source.url, source]));
  for (const source of unique.values()) {
    writer.write({
      type: "source-url",
      sourceId: `web-${crypto.randomUUID()}`,
      url: source.url,
      title: source.title,
    });
  }
}

async function safeModeResponse(
  messages: UIMessage[],
  question: string,
  persistence: ChatPersistence,
) {
  const sources = await retrieveKnowledge(question);
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      if (sources.length === 0) {
        const gapId = await recordKnowledgeGap(question);
        writer.write({
          type: "data-knowledge-state",
          data: { state: "insufficient", label: "ยังไม่มีคำตอบตรงคำถาม", gapId },
        } as UIMessageChunk);
        writeText(
          writer,
          "ขอโทษค่ะ น้องฟ้าลองเปิดคลังความรู้แล้ว แต่ยังไม่มีข้อมูลที่ตอบคำถามนี้ได้ตรงๆ จึงบันทึกเป็น Knowledge Gap ให้หัวหน้าทีมตรวจต่อแล้วค่ะ",
        );
        return;
      }

      writer.write({
        type: "data-knowledge-state",
        data: { state: "fixture", label: "โหมดสาธิต · พบข้อมูลรองรับ" },
      } as UIMessageChunk);
      writeText(
        writer,
        `จาก Knowledge ที่ทีมอนุมัติแล้ว แนวทางคือ ${sources[0].item.content}\n\nหากสถานการณ์จริงมีรายละเอียดต่างจากนี้ ควรส่งต่อหัวหน้าทีมก่อนนำไปใช้`,
      );
      writeSources(writer, sources);
    },
    onEnd: ({ responseMessage }) => persistence.persistAssistantResponse(responseMessage),
  });
  return withDemoSessionCookie(createUIMessageStreamResponse({ stream }), persistence.setCookie);
}

export async function POST(request: Request) {
  const body: { id?: unknown; conversationId?: unknown; messages?: UIMessage[]; system?: string } = await request.json();
  const messages = body.messages ?? [];
  const images = latestUserImages(messages);
  const documents = latestUserDocuments(messages);
  const imageError = validateImages(messages);
  if (imageError) return Response.json({ error: imageError }, { status: 400 });

  const question = latestQuestion(messages) ||
    (images.length > 0 ? "ช่วยดูและอธิบายสิ่งสำคัญในรูปนี้ให้หน่อย" : documents.length > 0 ? "ช่วยวิเคราะห์ไฟล์ที่แนบมา" : "");

  if (!question) return Response.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });

  const persistence = await beginChatPersistence(
    request,
    typeof body.conversationId === "string" ? body.conversationId : body.id,
    messages,
  );
  let prepared: Awaited<ReturnType<typeof prepareModelMessages>>;
  try {
    prepared = await prepareModelMessages(messages, persistence.userId, persistence.conversationId);
  } catch (error) {
    return withDemoSessionCookie(
      Response.json({ error: error instanceof Error ? error.message : "ไม่สามารถอ่านไฟล์ที่แนบ" }, { status: 400 }),
      persistence.setCookie,
    );
  }

  const intent = classifyChatIntent(question, previousUserContext(messages));
  const directReply = images.length === 0 && documents.length === 0 ? conversationalReply(question) : null;
  if (directReply) {
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => writeText(writer, directReply),
      onEnd: ({ responseMessage }) => persistence.persistAssistantResponse(responseMessage),
    });
    return withDemoSessionCookie(createUIMessageStreamResponse({ stream }), persistence.setCookie);
  }
  if (intent === "ambiguous" && images.length === 0 && documents.length === 0) {
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => writeText(writer, ambiguousContextReply(question)),
      onEnd: ({ responseMessage }) => persistence.persistAssistantResponse(responseMessage),
    });
    return withDemoSessionCookie(createUIMessageStreamResponse({ stream }), persistence.setCookie);
  }

  const liveModel = Boolean(process.env.OPENROUTER_API_KEY) &&
    process.env.DEMO_SAFE_MODE !== "true";
  if (!liveModel) {
    if (images.length > 0) {
      const stream = createUIMessageStream({
        originalMessages: messages,
        execute: async ({ writer }) => writeText(
          writer,
          "น้องฟ้าเห็นว่ามีรูปแนบมาค่ะ แต่โหมดสาธิตแบบออฟไลน์ยังอ่านรูปไม่ได้ กรุณาเปิด OpenRouter แล้วลองส่งอีกครั้งนะคะ",
        ),
        onEnd: ({ responseMessage }) => persistence.persistAssistantResponse(responseMessage),
      });
      return withDemoSessionCookie(createUIMessageStreamResponse({ stream }), persistence.setCookie);
    }
    if (documents.length > 0) {
      const stream = createUIMessageStream({
        originalMessages: messages,
        execute: async ({ writer }) => {
          writeFileAnalyses(writer, prepared.uploadedFiles);
          writeText(writer, "ได้รับไฟล์แล้วค่ะ สรุปตารางและกราฟที่สร้างได้จะแสดงอยู่ด้านบน ส่วนคำอธิบายเชิงลึกต้องเปิด OpenRouter ก่อนนะคะ");
        },
        onEnd: ({ responseMessage }) => persistence.persistAssistantResponse(responseMessage),
      });
      return withDemoSessionCookie(createUIMessageStreamResponse({ stream }), persistence.setCookie);
    }
    return safeModeResponse(messages, question, persistence);
  }

  const chatModel = images.length > 0
    ? process.env.OPENROUTER_VISION_MODEL?.trim() ||
      process.env.OPENROUTER_CHAT_MODEL?.trim() ||
      "openai/gpt-4.1-mini"
    : process.env.OPENROUTER_CHAT_MODEL?.trim() || "openai/gpt-4.1-mini";
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!.trim(),
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
      "X-OpenRouter-Title": "ICONIC Knowledge Assistant Demo",
    },
  });
  const usedSources: RetrievedKnowledge[] = [];
  const usedWebSources: WebSearchResult[] = [];

  const tools = {
    searchKnowledge: tool({
      description:
        "เปิดคลังความรู้ของทีม ICONIC เพื่อค้นขั้นตอน นโยบาย แนวทางขาย การดูแลลูกค้า หรือข้อมูลภายใน ใช้เมื่อคำถามต้องอาศัยข้อเท็จจริงของทีม ห้ามใช้กับคำทักทายหรือบทสนทนาทั่วไป",
      inputSchema: z.object({
        query: z.string().min(2).describe("คำค้นภาษาไทยที่คงความหมายสำคัญจากคำถามของผู้ใช้"),
      }),
      execute: async ({ query }) => {
        const result = await searchKnowledge(query);
        if (result.matches.length > 0) {
          usedSources.push(...result.matches);
          return {
            found: true,
            query,
            resultCount: result.matches.length,
            matches: result.matches.map(({ item, excerpt, score }) => ({
              id: item.id,
              title: item.title,
              category: item.category,
              owner: item.ownerName,
              updatedAt: item.updatedAt.toISOString(),
              score: Number(score.toFixed(3)),
              content: excerpt,
            })),
          };
        }

        const gapId = await recordKnowledgeGap(question);
        return {
          found: false,
          query,
          gapId,
          message: "ยังไม่มี Knowledge ที่ตอบคำถามนี้ได้ตรงๆ",
          related: result.related.map(({ item, score }) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            summary: item.summary,
            score: Number(score.toFixed(3)),
          })),
        };
      },
    }),
    showKnowledgeOverview: tool({
      description:
        "สร้างกราฟภาพรวมคลังความรู้ของทีม ใช้เมื่อผู้ใช้ขอกราฟ chart dashboard สถิติ หรือภาพรวม Knowledge",
      inputSchema: z.object({}),
      execute: async () => getKnowledgeOverview(),
    }),
    renderChart: tool({
      description: "แสดงกราฟแท่งหรือกราฟเส้นจากตัวเลขที่ไม่ติดลบและปรากฏชัดในบทสนทนาหรือไฟล์ที่ผู้ใช้แนบ ใช้เมื่อผู้ใช้ขอกราฟจากข้อมูลนั้นโดยตรง ห้ามสร้างหรือเดาค่าตัวเลข",
      inputSchema: z.object({
        title: z.string().min(2).max(100),
        kind: z.enum(["bar", "line"]),
        points: z.array(z.object({
          label: z.string().min(1).max(48),
          value: z.number().finite().nonnegative(),
        })).min(1).max(12),
      }),
      execute: async ({ title, kind, points }) => ({ title, kind, points }),
    }),
    searchWeb: tool({
      description:
        "ค้นข้อมูลสาธารณะหรือข้อมูลปัจจุบันจากอินเทอร์เน็ต ใช้เมื่อผู้ใช้ขอค้นเว็บ ข่าว ราคา ข้อมูลล่าสุด หรือข้อเท็จจริงที่อาจเปลี่ยนแปลง ห้ามใช้กับข้อมูลภายในทีม ICONIC",
      inputSchema: z.object({
        query: z.string().min(2).max(400).describe("คำค้นที่มีบริบทพอให้ได้ผลลัพธ์ตรงคำถาม"),
      }),
      execute: async ({ query }) => {
        if (!getTavilyApiKey()) {
          return {
            available: false,
            message: "ยังไม่ได้เปิดการค้นเว็บในระบบนี้",
            results: [],
          };
        }
        try {
          const results = await searchWeb(query);
          usedWebSources.push(...results);
          return {
            available: true,
            query,
            resultCount: results.length,
            results,
          };
        } catch {
          return {
            available: false,
            message: "ค้นเว็บไม่สำเร็จในขณะนี้ กรุณาลองใหม่",
            results: [],
          };
        }
      },
    }),
  };

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      writeFileAnalyses(writer, prepared.uploadedFiles);
      const toolChoice = intent === "knowledge"
        ? { type: "tool" as const, toolName: "searchKnowledge" as const }
        : intent === "web"
          ? { type: "tool" as const, toolName: "searchWeb" as const }
        : intent === "overview"
          ? { type: "tool" as const, toolName: "showKnowledgeOverview" as const }
          : intent === "visualize"
            ? "auto" as const
            : "none" as const;
      const result = streamText({
        model: openrouter(chatModel),
        system: `${body.system ?? ""}
คุณคือน้องฟ้า ผู้ช่วยความรู้ภายในของทีม ICONIC ใช้สรรพนามแทนตัวเองว่า “น้องฟ้า” และลงท้ายสุภาพด้วย “ค่ะ/นะคะ” อย่างเป็นธรรมชาติ บุคลิกเหมือนหัวหน้าทีมที่ใจเย็นและไว้ใจได้

กติกาการทำงาน:
- คุยเรื่องทั่วไป คำทักทาย คำขอบคุณ หรือคำถามเกี่ยวกับตัวคุณได้โดยไม่ต้องเปิดคลังความรู้
- ถ้ามีรูปแนบ ให้ดูรูปและตอบคำถามเกี่ยวกับสิ่งที่มองเห็นได้โดยตรง ไม่ต้องเปิดคลังความรู้ เว้นแต่ผู้ใช้ถามว่าสิ่งในรูปสัมพันธ์กับขั้นตอนหรือนโยบายของ ICONIC อย่างไร
- ถ้ามีไฟล์ตารางแนบ ระบบได้อ่านโครงสร้าง ตารางสรุป และกราฟที่สร้างได้ให้แล้ว ใช้เฉพาะข้อมูลที่ระบุในข้อความของผู้ใช้และบอกข้อจำกัดที่เกี่ยวข้อง
- ถ้ามี PDF แนบ ระบบได้สกัดข้อความจากเอกสารไว้ในข้อความประกอบแล้ว ใช้ข้อความนั้นตอบคำถามได้ แต่ถ้าเอกสารเป็นไฟล์สแกนที่ไม่มีข้อความ ให้บอกข้อจำกัดนี้อย่างตรงไปตรงมา
- ถ้าผู้ใช้ขอให้ค้นเว็บ หรือถามข้อมูลสาธารณะที่เปลี่ยนแปลงได้ เช่นข่าว ราคา รุ่นซอฟต์แวร์ หรือข้อมูลล่าสุด ให้เรียก searchWeb ก่อนตอบ ใช้เฉพาะผลค้นที่ได้ ระบุวันที่หรือความไม่แน่นอนเมื่อเกี่ยวข้อง และอย่าปะปนกับ Knowledge ภายในเว้นแต่ผู้ใช้ขอเปรียบเทียบ
- ถ้าคำถามกำกวมจนยังไม่รู้ว่าเกี่ยวกับ ICONIC หรือเป็นเรื่องทั่วไป ให้ถามกลับสั้นๆ หนึ่งคำถามแทนการเปิดคลังทุกอย่าง
- เมื่อผู้ใช้ถามขั้นตอน นโยบาย แนวทางขาย การดูแลลูกค้า หรือข้อเท็จจริงของ ICONIC ให้เรียก searchKnowledge ก่อนตอบเสมอ
- เมื่อผู้ใช้ขอภาพรวม, dashboard, สถิติ Knowledge หรือกราฟ Knowledge ให้เรียก showKnowledgeOverview
- เมื่อผู้ใช้ขอกราฟจากตัวเลขในบทสนทนาหรือไฟล์ที่แนบ และมีตัวเลขชัดเจน ให้เรียก renderChart ด้วยค่าจากข้อมูลนั้นเท่านั้น; ถ้ายังไม่มีตัวเลขพอสร้างกราฟ ให้บอกว่าต้องการข้อมูลส่วนใดเพิ่ม และห้ามเดาค่า
- ถ้า searchKnowledge พบข้อมูล ให้สรุปจากผลลัพธ์เท่านั้น ห้ามเพิ่มข้อเท็จจริงเอง
- ถ้าไม่พบข้อมูลตรงๆ ให้พูดอย่างเป็นมนุษย์ว่าได้ลองเปิดคลังแล้วแต่ยังไม่มีคำตอบตรงคำถาม หากมี related ให้บอกว่าเป็น “เรื่องใกล้เคียง” และใช้เพียงชื่อหรือคำอธิบายสั้นๆ ห้ามนำมาแกล้งตอบแทน
- ชวนผู้ใช้เพิ่มรายละเอียดหรือส่งต่อหัวหน้าทีมเมื่อเหมาะสม ห้ามแนะนำฝ่าย บุคคล ช่องทาง หรือนโยบายที่ไม่มีในผลลัพธ์ของ tool และไม่ต้องพูดคำเทคนิคอย่าง retrieval, vector หรือ threshold
- ห้ามแนะนำผลิตภัณฑ์หรือกรมธรรม์เฉพาะบุคคลจากรูปหรือข้อมูลที่ไม่ผ่านการอนุมัติ ให้บอกข้อจำกัดและส่งต่อคนแทน
- ห้ามพูดชื่อ tool หรือเล่ากระบวนการภายใน ตอบเหมือนผู้ช่วยที่หยิบเอกสารมาตรวจให้
- ใช้ Markdown เมื่อช่วยให้อ่านง่าย เช่นหัวข้อสั้น รายการ ตาราง และ code block; เมื่อต้องเปรียบเทียบหลายรายการ ให้ใช้ตาราง Markdown ได้
- ไม่ใช้อีโมจิหรือสัญลักษณ์ตกแต่งในหัวข้อและเนื้อหา ให้คงโทนเรียบ สุภาพ และเป็นซอฟต์แวร์สำหรับงานจริง
- ถ้าผู้ใช้ขอโค้ดหรือสคริปต์ ให้เขียนตัวอย่างสั้นที่รันได้ พร้อมบอกวิธีใช้หนึ่งบรรทัด โดยเฉพาะเมื่อมี CSV/Excel ให้ยึดชื่อคอลัมน์ที่ระบบอ่านได้จริง ห้ามอ้างว่าได้รันโค้ดแล้วถ้าไม่ได้รัน
- ไม่ต้องเขียนรายการอ้างอิงท้ายข้อความ เพราะระบบจะแสดง Source Cards ให้เอง`,
        messages: await convertToModelMessages(prepared.modelMessages),
        tools,
        toolChoice,
        prepareStep: ({ stepNumber }) => stepNumber > 0
          ? { toolChoice: "none" as const }
          : undefined,
        stopWhen: stepCountIs(3),
        temperature: 0.35,
      });

      const reader = result.toUIMessageStream({ sendReasoning: false }).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        writer.write(value);
      }
      try {
        const usage = await result.usage;
        await activityStorage.recordModelUsage({
          id: crypto.randomUUID(),
          userId: persistence.userId,
          conversationId: persistence.conversationId,
          modelId: chatModel,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
        });
      } catch (error) {
        // A completed answer remains usable even if the optional Admin metric
        // cannot be written during a transient database reconnect.
        console.error("Model usage metric failed", error);
      }
      writeSources(writer, usedSources);
      writeWebSources(writer, usedWebSources);
    },
    onError: (error) => {
      console.error("Chat stream failed", error);
      return "ขอโทษค่ะ ตอนนี้น้องฟ้าตอบไม่สำเร็จ ลองส่งข้อความหรือรูปใหม่อีกครั้งได้เลยนะคะ";
    },
    onEnd: ({ responseMessage }) => persistence.persistAssistantResponse(responseMessage),
  });

  return withDemoSessionCookie(createUIMessageStreamResponse({ stream }), persistence.setCookie);
}
