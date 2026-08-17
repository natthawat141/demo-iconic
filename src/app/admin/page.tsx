import {
  ArrowUpRight,
  BookOpenCheck,
  CircleAlert,
  Database,
  FileClock,
  MessagesSquare,
} from "lucide-react";
import Link from "next/link";

import { activityStorage } from "@/db/activity-storage";
import { Button } from "@/components/ui/button";
import { listGaps, listKnowledge } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [knowledge, gaps, users, conversations, files] = await Promise.all([
    listKnowledge(),
    listGaps(),
    activityStorage.listUsers(),
    activityStorage.listConversations({ limit: 500 }),
    activityStorage.listUploadedFiles(500),
  ]);
  const approved = knowledge.filter((item) => item.status === "approved").length;
  const drafts = knowledge.filter((item) => item.status === "draft").length;
  const activeGaps = gaps.filter((gap) => gap.status === "new" || gap.status === "escalated").length;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-5 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Database className="size-3.5" /> System overview
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-[-0.03em] sm:text-3xl">Knowledge operations</h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            ติดตามวงจรความรู้ตั้งแต่คำถามของทีม ไปจนถึงการอนุมัติและนำกลับมาใช้ตอบอย่างตรวจสอบได้
          </p>
        </div>
        <Button render={<Link href="/knowledge/new" />} nativeButton={false} className="h-10">
          เพิ่ม Knowledge <ArrowUpRight className="size-4" />
        </Button>
      </div>

      <section className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-2 xl:grid-cols-5" aria-label="สถิติระบบ">
        {[
          { label: "พร้อมใช้งาน", value: approved, detail: "Approved knowledge", icon: BookOpenCheck },
          { label: "รอตรวจทาน", value: drafts, detail: "Draft knowledge", icon: FileClock },
          { label: "คำถามที่รอคำตอบ", value: activeGaps, detail: "ต้องจัดการต่อ", icon: CircleAlert },
          { label: "ผู้ใช้เดโม", value: users.length, detail: `${conversations.length} บทสนทนา`, icon: MessagesSquare },
          { label: "ไฟล์อัปโหลด", value: files.length, detail: "Cloud Storage metadata", icon: Database },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                <Icon className="size-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.04em]">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
            </div>
          );
        })}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-xl bg-card ring-1 ring-border">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">งานที่ต้องดำเนินการ</h2>
              <p className="mt-1 text-xs text-muted-foreground">รายการสำคัญสำหรับ Knowledge manager</p>
            </div>
            <Button render={<Link href="/gaps" />} nativeButton={false} variant="ghost" size="sm">ดูทั้งหมด</Button>
          </div>
          <div className="divide-y divide-border">
            {gaps.slice(0, 5).map((gap) => (
              <Link key={gap.id} href="/gaps" className="flex min-h-16 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/55">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.96_0.04_75)] text-[oklch(0.46_0.12_75)] dark:bg-[oklch(0.3_0.06_75)] dark:text-[oklch(0.78_0.12_75)]">
                  <CircleAlert className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{gap.question}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">ถูกถาม {gap.count} ครั้ง · {gap.status}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-[oklch(0.22_0.035_255)] p-5 text-[oklch(0.94_0.01_255)] dark:bg-[oklch(0.205_0.035_255)]">
          <p className="font-mono text-[10px] text-[oklch(0.72_0.08_250)]">LIVE PIPELINE</p>
          <h2 className="mt-3 text-lg font-semibold">Answer quality loop</h2>
          <ol className="mt-5 space-y-4 text-sm">
            {[
              ["01", "รับคำถามจากทีม"],
              ["02", "ค้นเฉพาะ Knowledge ที่อนุมัติแล้ว"],
              ["03", "อ้างอิงแหล่งข้อมูลหรือสร้าง Gap"],
              ["04", "หัวหน้าทีมตรวจและอนุมัติ"],
            ].map(([number, label]) => (
              <li key={number} className="flex items-center gap-3">
                <span className="font-mono text-xs text-[oklch(0.72_0.12_250)]">{number}</span>
                <span className="text-[oklch(0.88_0.01_255)]">{label}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
