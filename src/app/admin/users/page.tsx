import { MessageSquareText, UserRound } from "lucide-react";
import Link from "next/link";

import { activityStorage } from "@/db/activity-storage";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function displayId(id: string) {
  return id.length > 22 ? `${id.slice(0, 14)}…${id.slice(-6)}` : id;
}

export default async function AdminUsersPage() {
  const [users, conversations] = await Promise.all([
    activityStorage.listUsers(),
    activityStorage.listConversations({ limit: 500 }),
  ]);
  const conversationsByUser = new Map<string, number>();
  for (const conversation of conversations) {
    conversationsByUser.set(conversation.userId, (conversationsByUser.get(conversation.userId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">DEMO IDENTITY</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">ผู้ใช้งานที่มีบทสนทนา</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">แต่ละ browser ได้ Demo User ID จาก cookie; หน้านี้ใช้ตรวจว่าใครเริ่มคุยและมีประวัติเท่าไร</p>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{users.length} users</p>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card" aria-label="รายชื่อผู้ใช้">
        {users.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">ยังไม่มีผู้ใช้ส่งข้อความ</div>
        ) : users.map((user) => (
          <div key={user.id} className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium" title={user.id}>{displayId(user.id)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">เริ่มใช้ {user.createdAt.toLocaleString("th-TH")} · ใช้งานล่าสุด {user.lastSeenAt.toLocaleString("th-TH")}</p>
            </div>
            <Button render={<Link href={`/admin/conversations?user=${encodeURIComponent(user.id)}`} />} nativeButton={false} variant="outline" size="sm">
              <MessageSquareText className="size-3.5" /> {conversationsByUser.get(user.id) ?? 0} บทสนทนา
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
