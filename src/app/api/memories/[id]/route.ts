import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, isValidDemoIdentifier, withDemoSessionCookie } from "@/lib/chat-persistence";

export const dynamic = "force-dynamic";

type MemoryRouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: MemoryRouteContext) {
  const { id } = await context.params;
  const { userId, setCookie } = await getDemoUserForRequest(request);
  if (!isValidDemoIdentifier(id)) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบความจำ" }, { status: 404 }), setCookie);
  }
  const deleted = await activityStorage.deleteUserMemory(id, userId);
  if (!deleted) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบความจำ" }, { status: 404 }), setCookie);
  }
  return withDemoSessionCookie(Response.json({ deleted: true }), setCookie);
}
