import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, withDemoSessionCookie } from "@/lib/chat-persistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId, setCookie } = await getDemoUserForRequest(request);
  const q = new URL(request.url).searchParams.get("q")?.normalize("NFKC").trim().slice(0, 100) ?? "";
  const conversations = await activityStorage.listConversations({ userId, query: q, limit: q ? 80 : 30 });

  return withDemoSessionCookie(Response.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    })),
  }), setCookie);
}
