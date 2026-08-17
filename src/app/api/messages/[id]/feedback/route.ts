import { z } from "zod";

import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, withDemoSessionCookie } from "@/lib/chat-persistence";

const feedbackSchema = z.object({ value: z.enum(["up", "down"]) });

export async function POST(request: Request, context: RouteContext<"/api/messages/[id]/feedback">) {
  const { id } = await context.params;
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ค่า feedback ไม่ถูกต้อง" }, { status: 400 });

  const { userId, setCookie } = await getDemoUserForRequest(request);
  const owner = await activityStorage.getMessageOwner(id);
  if (!owner) return withDemoSessionCookie(Response.json({ error: "ไม่พบคำตอบนี้" }, { status: 404 }), setCookie);
  if (owner.userId !== userId) {
    return withDemoSessionCookie(Response.json({ error: "ไม่มีสิทธิ์ให้ feedback คำตอบนี้" }, { status: 403 }), setCookie);
  }
  await activityStorage.saveFeedback(id, userId, parsed.data.value);
  return withDemoSessionCookie(Response.json({ ok: true, value: parsed.data.value }), setCookie);
}
