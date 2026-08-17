import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, withDemoSessionCookie } from "@/lib/chat-persistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId, setCookie } = await getDemoUserForRequest(request);
  const conversations = await activityStorage.listConversations({ userId, limit: 30 });

  return withDemoSessionCookie(Response.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    })),
  }), setCookie);
}
