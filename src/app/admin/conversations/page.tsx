import { ArrowUpRight, MessageSquareText, UserRound } from "lucide-react";
import Link from "next/link";

import { activityStorage } from "@/db/activity-storage";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function displayId(id: string) {
  return id.length > 24 ? `${id.slice(0, 16)}…${id.slice(-6)}` : id;
}

export default async function AdminConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user } = await searchParams;
  const conversations = await activityStorage.listConversations({ userId: user, limit: 150 });

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">CONVERSATION REVIEW</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">บทสนทนาของทีม</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">อ่านข้อความที่บันทึกพร้อม Source Cards เพื่อ review การตอบและหา Knowledge Gap ต่อได้</p>
        </div>
        {user ? <Button render={<Link href="/admin/conversations" />} nativeButton={false} variant="outline" size="sm">แสดงทุกผู้ใช้</Button> : null}
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card" aria-label="บทสนทนา">
        {conversations.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">ยังไม่มีบทสนทนาที่ตรงกับเงื่อนไข</div>
        ) : conversations.map((conversation) => (
          <Link key={conversation.id} href={`/admin/conversations/${conversation.id}`} className="group flex gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/50">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquareText className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{conversation.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><UserRound className="size-3" /> {displayId(conversation.userId)} <span>·</span> อัปเดต {conversation.updatedAt.toLocaleString("th-TH")}</span>
            </span>
            <ArrowUpRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>
    </div>
  );
}
