import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { Assistant } from "./assistant";
import { activityStorage } from "@/db/activity-storage";
import { DEMO_USER_COOKIE, isValidDemoIdentifier } from "@/lib/chat-persistence";
import { toHistoryMessages } from "@/lib/conversation-history";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; new?: string }>;
}) {
  const { conversation: requestedConversationId, new: newThreadKey } = await searchParams;
  const { userId: clerkUserId } = await auth();
  const cookieStore = await cookies();
  const userId = clerkUserId ?? cookieStore.get(DEMO_USER_COOKIE)?.value;
  const canLoadConversation = isValidDemoIdentifier(userId) && isValidDemoIdentifier(requestedConversationId);
  const detail = canLoadConversation ? await activityStorage.getConversation(requestedConversationId!) : null;
  const conversation = detail?.conversation.userId === userId ? detail : null;

  return (
    <Assistant
      key={conversation?.conversation.id ?? `new-${newThreadKey ?? "default"}`}
      conversationId={conversation?.conversation.id}
      initialMessages={conversation ? toHistoryMessages(conversation) : []}
    />
  );
}
