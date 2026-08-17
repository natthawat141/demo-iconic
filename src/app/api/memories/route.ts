import { z } from "zod";

import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, withDemoSessionCookie } from "@/lib/chat-persistence";
import { saveUserMemory } from "@/lib/user-memory";

export const dynamic = "force-dynamic";

const memoryInput = z.object({
  content: z.string().min(3).max(600),
  kind: z.enum(["preference", "project", "fact", "instruction"]).default("fact"),
});

function serialize(memory: Awaited<ReturnType<typeof activityStorage.listUserMemories>>[number]) {
  return {
    id: memory.id,
    content: memory.content,
    kind: memory.kind,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    lastUsedAt: memory.lastUsedAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  const { userId, setCookie } = await getDemoUserForRequest(request);
  const memories = await activityStorage.listUserMemories(userId, 100);
  return withDemoSessionCookie(Response.json({ memories: memories.map(serialize) }), setCookie);
}

export async function POST(request: Request) {
  const { userId, setCookie } = await getDemoUserForRequest(request);
  const parsed = memoryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return withDemoSessionCookie(Response.json({ error: "ข้อมูลความจำยังไม่ครบ" }, { status: 400 }), setCookie);
  }
  try {
    const memory = await saveUserMemory({ userId, ...parsed.data });
    return withDemoSessionCookie(Response.json({ memory: serialize(memory) }, { status: 201 }), setCookie);
  } catch (error) {
    return withDemoSessionCookie(Response.json({ error: error instanceof Error ? error.message : "บันทึกความจำไม่สำเร็จ" }, { status: 400 }), setCookie);
  }
}
