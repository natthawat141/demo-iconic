import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

import { activityStorage } from "@/db/activity-storage";
import { listGaps, listKnowledge } from "@/lib/knowledge";

function fallbackAnswer(input: {
  knowledgeCount: number;
  gaps: Array<{ question: string; count: number; status: string }>;
  users: number;
  conversations: number;
  files: number;
}) {
  const activeGaps = input.gaps.filter((gap) => gap.status === "new" || gap.status === "escalated");
  const topGap = [...activeGaps].sort((a, b) => b.count - a.count)[0];
  return [
    `ตอนนี้มี Knowledge ${input.knowledgeCount} รายการ, ผู้ใช้เดโม ${input.users} คน, บทสนทนา ${input.conversations} รายการ และไฟล์ ${input.files} รายการค่ะ`,
    topGap
      ? `เรื่องที่ควรตรวจต่อก่อนคือ “${topGap.question}” เพราะพบ ${topGap.count} ครั้ง`
      : "ยังไม่มี Knowledge Gap ที่เปิดอยู่ค่ะ",
    "ข้อเสนอ: เปิด transcript ที่เกี่ยวข้อง, ตรวจความถูกต้องกับเจ้าของเนื้อหา แล้วค่อยสร้าง Draft Knowledge เพื่อให้คนอนุมัติก่อนเผยแพร่ค่ะ",
  ].join("\n\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 1200) : "";
  if (!question) return Response.json({ error: "กรุณาพิมพ์คำถามสำหรับ Admin AI" }, { status: 400 });

  const [knowledge, gaps, users, conversations, files] = await Promise.all([
    listKnowledge(),
    listGaps(),
    activityStorage.listUsers(300),
    activityStorage.listConversations({ limit: 300 }),
    activityStorage.listUploadedFiles(300),
  ]);
  const context = {
    knowledgeCount: knowledge.length,
    approvedKnowledge: knowledge.filter((item) => item.status === "approved").length,
    gaps: gaps.slice(0, 20).map((gap) => ({ question: gap.question, count: gap.count, status: gap.status })),
    users: users.length,
    conversations: conversations.length,
    files: files.length,
    spreadsheets: files.filter((file) => file.kind === "spreadsheet").length,
  };
  const liveModel = Boolean(process.env.OPENROUTER_API_KEY) && process.env.DEMO_SAFE_MODE !== "true";
  if (!liveModel) return Response.json({ answer: fallbackAnswer(context), mode: "demo" });

  try {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
        "X-OpenRouter-Title": "ICONIC Admin AI Workspace",
      },
    });
    const result = await generateText({
      model: openrouter(process.env.OPENROUTER_CHAT_MODEL?.trim() || "openai/gpt-4.1-mini"),
      temperature: 0.25,
      maxOutputTokens: 500,
      system: `คุณคือ Admin AI ของ ICONIC ช่วยผู้ดูแลวิเคราะห์และวางงานจากข้อมูลสรุปที่ให้เท่านั้น
กติกา: ตอบภาษาไทย กระชับ ใช้ markdown ได้; เสนอสิ่งที่ควรตรวจหรือ Draft Knowledge ได้ แต่ห้ามบอกว่าได้อนุมัติ แก้ไข ลบ ส่ง หรือดำเนินการแทนผู้ดูแลแล้ว; ห้ามแต่งข้อมูลหรือระบุชื่อบุคคล/ข้อเท็จจริงที่ไม่มีในข้อมูลสรุป; หากคำถามต้องเปิดบทสนทนาเฉพาะรายการ ให้ชวนผู้ดูแลไปเปิดหน้า transcript.
ข้อมูลสรุประบบ:\n${JSON.stringify(context)}`,
      prompt: question,
    });
    return Response.json({ answer: result.text, mode: "openrouter" });
  } catch (error) {
    console.error("Admin AI failed", error);
    return Response.json({ answer: fallbackAnswer(context), mode: "demo-fallback" });
  }
}
