import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

import { recordKnowledgeGap, retrieveKnowledge } from "@/lib/knowledge";

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

function writeText(
  writer: { write: (chunk: UIMessageChunk) => void },
  text: string,
) {
  const id = crypto.randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

export async function POST(request: Request) {
  const body: { messages?: UIMessage[]; system?: string } = await request.json();
  const messages = body.messages ?? [];
  const question = latestQuestion(messages);

  if (!question) {
    return Response.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });
  }

  const sources = await retrieveKnowledge(question);
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      if (sources.length === 0) {
        const gapId = recordKnowledgeGap(question);
        writer.write({
          type: "data-knowledge-state",
          data: {
            state: "insufficient",
            label: "ข้อมูลไม่เพียงพอ",
            gapId,
          },
        } as UIMessageChunk);
        writeText(
          writer,
          "ยังไม่พบ Knowledge ที่ได้รับอนุมัติเพียงพอสำหรับคำถามนี้ น้องฟ้าจะไม่คาดเดาคำตอบ คุณสามารถส่งคำถามนี้ให้หัวหน้าทีมเพื่อเพิ่มเป็นความรู้ของทีมได้",
        );
        return;
      }

      const hasLiveModel = Boolean(
        process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_CHAT_MODEL,
      );
      const safeMode =
        process.env.DEMO_SAFE_MODE === "true" || !hasLiveModel;

      writer.write({
        type: "data-knowledge-state",
        data: {
          state: safeMode ? "fixture" : "grounded",
          label: safeMode
            ? "โหมดสาธิต · พบข้อมูลรองรับ"
            : "พบข้อมูลรองรับ",
        },
      } as UIMessageChunk);

      if (safeMode) {
        const primary = sources[0].item;
        writeText(
          writer,
          `จาก Knowledge ที่ทีมอนุมัติแล้ว แนวทางคือ ${primary.content}\n\nหากสถานการณ์จริงมีรายละเอียดต่างจากนี้ ควรส่งต่อหัวหน้าทีมก่อนนำไปใช้`,
        );
      } else {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
          headers: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            "X-OpenRouter-Title": "ICONIC Knowledge Assistant Demo",
          },
        });
        const context = sources
          .map(
            ({ item, excerpt }, index) =>
              `[SOURCE ${index + 1}]\nTitle: ${item.title}\nCategory: ${item.category}\nOwner: ${item.ownerName}\nUpdated: ${item.updatedAt.toISOString()}\nContent:\n${excerpt}`,
          )
          .join("\n\n");
        const result = streamText({
          model: openrouter(process.env.OPENROUTER_CHAT_MODEL!),
          system: `${body.system ?? ""}\nคุณคือน้องฟ้า ผู้ช่วยความรู้ภายในของทีม ICONIC\nตอบภาษาไทยอย่างกระชับและเป็นธรรมชาติ ใช้เฉพาะ CONTEXT ที่ให้มาเป็นข้อเท็จจริงของ ICONIC ห้ามสร้างขั้นตอน นโยบาย หรือคำแนะนำเฉพาะบุคคลเพิ่มเอง หากบริบทขัดแย้งให้แจ้งว่าต้องส่งต่อหัวหน้าทีม ไม่ต้องสร้างรายการแหล่งอ้างอิงในข้อความ เพราะระบบจะแสดง Source Cards ให้เอง\n\nCONTEXT\n${context}`,
          messages: await convertToModelMessages(messages),
          temperature: 0.2,
        });

        const reader = result.toUIMessageStream().getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          writer.write(value);
        }
      }

      for (const { item } of sources) {
        writer.write({
          type: "source-url",
          sourceId: item.id,
          url: `/knowledge/${item.id}`,
          title: `${item.title} · ${item.category}`,
        });
      }
    },
    onError: (error) => {
      console.error("Chat stream failed", error);
      return "น้องฟ้ายังตอบไม่ได้ในขณะนี้ กรุณาลองอีกครั้งหรือเปิดโหมดสาธิต";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

