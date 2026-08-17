import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, isValidDemoIdentifier, withDemoSessionCookie } from "@/lib/chat-persistence";
import { toHistoryMessages } from "@/lib/conversation-history";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId, setCookie } = await getDemoUserForRequest(request);
  if (!isValidDemoIdentifier(id)) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบบทสนทนา" }, { status: 404 }), setCookie);
  }

  const detail = await activityStorage.getConversation(id);
  if (!detail || detail.conversation.userId !== userId) {
    // Keep another user's conversation indistinguishable from a missing one.
    return withDemoSessionCookie(Response.json({ error: "ไม่พบบทสนทนา" }, { status: 404 }), setCookie);
  }

  return withDemoSessionCookie(Response.json({
    conversation: {
      id: detail.conversation.id,
      title: detail.conversation.title,
      updatedAt: detail.conversation.updatedAt.toISOString(),
    },
    messages: toHistoryMessages(detail),
  }), setCookie);
}
