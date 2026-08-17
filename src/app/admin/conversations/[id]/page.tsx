import { ArrowLeft, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { activityStorage } from "@/db/activity-storage";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await activityStorage.getConversation(id);
  if (!detail) notFound();
  const sourcesByMessage = new Map<string, typeof detail.sources>();
  for (const source of detail.sources) {
    sourcesByMessage.set(source.messageId, [...(sourcesByMessage.get(source.messageId) ?? []), source]);
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:py-8">
      <Button render={<Link href="/admin/conversations" />} nativeButton={false} variant="ghost" size="sm" className="-ml-2"><ArrowLeft className="size-4" /> กลับไปบทสนทนา</Button>
      <header className="mt-4 border-b border-border pb-5">
        <p className="text-xs font-semibold text-primary">TRANSCRIPT</p>
        <h1 className="mt-2 text-xl font-bold tracking-[-0.02em]">{detail.conversation.title}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><UserRound className="size-3" /> {detail.conversation.userId}</p>
      </header>
      <section className="mt-6 space-y-4" aria-label="ข้อความในบทสนทนา">
        {detail.messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground" : "max-w-[85%] rounded-2xl border border-border bg-card px-4 py-3"}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-65">{message.role === "user" ? "Team member" : "Nong Fah"}</p>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.content || "(ไฟล์แนบ)"}</p>
            {message.attachments.map((attachment, index) => <p key={`${attachment.filename}-${index}`} className="mt-2 flex items-center gap-1.5 text-xs opacity-70"><FileText className="size-3" /> {attachment.filename ?? "ไฟล์แนบ"} · {attachment.mediaType}</p>)}
            {(sourcesByMessage.get(message.id) ?? []).map((source) => <Link key={source.sourceId} href={source.url} className="mt-2 block text-xs font-medium text-primary underline underline-offset-4">Source: {source.title}</Link>)}
            <p className="mt-2 text-[10px] opacity-60">{message.createdAt.toLocaleString("th-TH")}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
