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

import { conversationalReply } from "@/lib/chat-intent";
import {
  getKnowledgeOverview,
  recordKnowledgeGap,
  retrieveKnowledge,
  searchKnowledge,
  type RetrievedKnowledge,
} from "@/lib/knowledge";

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

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_DATA_URL_LENGTH = 7_100_000;

function latestUserImages(messages: UIMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.parts.filter((part) => part.type === "file") ?? [];
}

function validateImages(messages: UIMessage[]) {
  const images = latestUserImages(messages);
  if (images.length > 3) return "แนบรูปได้ไม่เกิน 3 รูปต่อข้อความ";
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
  return null;
}

function writeText(writer: { write: (chunk: UIMessageChunk) => void }, text: string) {
  const id = crypto.randomUUID();
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

async function safeModeResponse(
  messages: UIMessage[],
  question: string,
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
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(request: Request) {
  const body: { messages?: UIMessage[]; system?: string } = await request.json();
  const messages = body.messages ?? [];
  const images = latestUserImages(messages);
  const imageError = validateImages(messages);
  if (imageError) return Response.json({ error: imageError }, { status: 400 });

  const question = latestQuestion(messages) ||
    (images.length > 0 ? "ช่วยดูและอธิบายสิ่งสำคัญในรูปนี้ให้หน่อย" : "");

  if (!question) return Response.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });

  const directReply = images.length === 0 ? conversationalReply(question) : null;
  if (directReply) {
    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => writeText(writer, directReply),
    });
    return createUIMessageStreamResponse({ stream });
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
      });
      return createUIMessageStreamResponse({ stream });
    }
    return safeModeResponse(messages, question);
  }

  const chatModel = images.length > 0
    ? process.env.OPENROUTER_VISION_MODEL?.trim() ||
      process.env.OPENROUTER_CHAT_MODEL?.trim() ||
      "openai/gpt-4.1-mini"
    : process.env.OPENROUTER_CHAT_MODEL?.trim() || "openai/gpt-4.1-mini";
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": "ICONIC Knowledge Assistant Demo",
    },
  });
  const usedSources: RetrievedKnowledge[] = [];

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
  };

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const result = streamText({
        model: openrouter(chatModel),
        system: `${body.system ?? ""}
คุณคือน้องฟ้า ผู้ช่วยความรู้ภายในของทีม ICONIC ใช้สรรพนามแทนตัวเองว่า “น้องฟ้า” และลงท้ายสุภาพด้วย “ค่ะ/นะคะ” อย่างเป็นธรรมชาติ บุคลิกเหมือนหัวหน้าทีมที่ใจเย็นและไว้ใจได้

กติกาการทำงาน:
- คุยเรื่องทั่วไป คำทักทาย คำขอบคุณ หรือคำถามเกี่ยวกับตัวคุณได้โดยไม่ต้องเปิดคลังความรู้
- ถ้ามีรูปแนบ ให้ดูรูปและตอบคำถามเกี่ยวกับสิ่งที่มองเห็นได้โดยตรง ไม่ต้องเปิดคลังความรู้ เว้นแต่ผู้ใช้ถามว่าสิ่งในรูปสัมพันธ์กับขั้นตอนหรือนโยบายของ ICONIC อย่างไร
- ถ้าคำถามกำกวมจนยังไม่รู้ว่าเกี่ยวกับ ICONIC หรือเป็นเรื่องทั่วไป ให้ถามกลับสั้นๆ หนึ่งคำถามแทนการเปิดคลังทุกอย่าง
- เมื่อผู้ใช้ถามขั้นตอน นโยบาย แนวทางขาย การดูแลลูกค้า หรือข้อเท็จจริงของ ICONIC ให้เรียก searchKnowledge ก่อนตอบเสมอ
- เมื่อผู้ใช้ขอกราฟ chart dashboard สถิติ หรือภาพรวม ให้เรียก showKnowledgeOverview
- ถ้า searchKnowledge พบข้อมูล ให้สรุปจากผลลัพธ์เท่านั้น ห้ามเพิ่มข้อเท็จจริงเอง
- ถ้าไม่พบข้อมูลตรงๆ ให้พูดอย่างเป็นมนุษย์ว่าได้ลองเปิดคลังแล้วแต่ยังไม่มีคำตอบตรงคำถาม หากมี related ให้บอกว่าเป็น “เรื่องใกล้เคียง” และใช้เพียงชื่อหรือคำอธิบายสั้นๆ ห้ามนำมาแกล้งตอบแทน
- ชวนผู้ใช้เพิ่มรายละเอียดหรือส่งต่อหัวหน้าทีมเมื่อเหมาะสม ห้ามแนะนำฝ่าย บุคคล ช่องทาง หรือนโยบายที่ไม่มีในผลลัพธ์ของ tool และไม่ต้องพูดคำเทคนิคอย่าง retrieval, vector หรือ threshold
- ห้ามแนะนำผลิตภัณฑ์หรือกรมธรรม์เฉพาะบุคคลจากรูปหรือข้อมูลที่ไม่ผ่านการอนุมัติ ให้บอกข้อจำกัดและส่งต่อคนแทน
- ห้ามพูดชื่อ tool หรือเล่ากระบวนการภายใน ตอบเหมือนผู้ช่วยที่หยิบเอกสารมาตรวจให้
- ใช้ Markdown เมื่อช่วยให้อ่านง่าย เช่นหัวข้อสั้น รายการ หรือตาราง แต่ไม่ต้องจัดรูปแบบทุกคำตอบ
- ไม่ต้องเขียนรายการอ้างอิงท้ายข้อความ เพราะระบบจะแสดง Source Cards ให้เอง`,
        messages: await convertToModelMessages(messages),
        tools,
        toolChoice: "auto",
        stopWhen: stepCountIs(3),
        temperature: 0.35,
      });

      const reader = result.toUIMessageStream().getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        writer.write(value);
      }
      writeSources(writer, usedSources);
    },
    onError: (error) => {
      console.error("Chat stream failed", error);
      return "ขอโทษค่ะ ตอนนี้น้องฟ้าตอบไม่สำเร็จ ลองส่งข้อความหรือรูปใหม่อีกครั้งได้เลยนะคะ";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
