import { Activity, ArrowUpRight, BadgeDollarSign, Bot, MessageSquareText, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";

import { activityStorage } from "@/db/activity-storage";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function compactId(id: string) {
  return id.length > 22 ? `${id.slice(0, 14)}…${id.slice(-6)}` : id;
}

function count(value: number) {
  return value.toLocaleString("en-US");
}

export default async function AdminUsagePage() {
  const usage = await activityStorage.getModelUsageOverview(50);
  const mostActive = usage.users[0];
  const leastActive = usage.users.at(-1);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">LIVE MODEL METRICS</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">การใช้งานโมเดล</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            นับ token ที่ OpenRouter ส่งกลับหลังตอบสำเร็จ และนับคำถามจากประวัติแชตที่เก็บจริง
          </p>
        </div>
        <Button render={<Link href="/admin/conversations" />} nativeButton={false} variant="outline">
          ดูบทสนทนา <ArrowUpRight className="size-3.5" />
        </Button>
      </div>

      <section className="mt-6 grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปการใช้โมเดล">
        {[
          { label: "Model calls", value: count(usage.totalRequests), detail: "รอบที่โมเดลตอบสำเร็จ", icon: Activity },
          { label: "Input tokens", value: count(usage.inputTokens), detail: "ข้อความและบริบทที่ส่งเข้า", icon: MessageSquareText },
          { label: "Output tokens", value: count(usage.outputTokens), detail: "คำตอบที่โมเดลสร้าง", icon: Sparkles },
          { label: "Total tokens", value: count(usage.totalTokens), detail: "ใช้รวมทุกโมเดล", icon: BadgeDollarSign },
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Top model usage</h2>
            <p className="mt-1 text-xs text-muted-foreground">เรียงตาม total tokens</p>
          </div>
          {usage.models.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">ยังไม่มี model call ที่เก็บ token ได้ ลองส่งคำถามผ่าน OpenRouter หนึ่งครั้ง</p>
          ) : (
            <div className="divide-y divide-border">
              {usage.models.map((model) => (
                <div key={model.modelId} className="flex items-center gap-3 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium" title={model.modelId}>{model.modelId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{count(model.requestCount)} calls · in {count(model.inputTokens)} · out {count(model.outputTokens)}</p>
                  </div>
                  <p className="font-mono text-sm font-semibold tabular-nums">{count(model.totalTokens)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">คำถามมาก / น้อย</h2>
            <p className="mt-1 text-xs text-muted-foreground">จัดอันดับจากข้อความฝั่งผู้ใช้ ไม่ใช่จำนวนครั้งที่เปิดหน้าเว็บ</p>
          </div>
          {usage.users.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">ยังไม่มีคำถามที่บันทึกไว้</p>
          ) : (
            <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <UserRanking label="ถามมากที่สุด" user={mostActive} />
              <UserRanking label={leastActive?.userId === mostActive?.userId ? "ผู้ใช้รายเดียว" : "ถามน้อยที่สุด"} user={leastActive} />
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card" aria-label="อันดับผู้ใช้งาน">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">ผู้ใช้ตามจำนวนคำถาม</h2>
            <p className="mt-1 text-xs text-muted-foreground">เรียงจากมากไปน้อย · token เป็นเฉพาะการเรียกโมเดลที่มี usage กลับมา</p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{usage.users.length} users</p>
        </div>
        <div className="divide-y divide-border">
          {usage.users.map((user, index) => (
            <Link key={user.userId} href={`/admin/conversations?user=${encodeURIComponent(user.userId)}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">{index + 1}</span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-medium" title={user.userId}>{compactId(user.userId)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">ถามล่าสุด {user.lastAskedAt.toLocaleString("th-TH")}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm font-semibold tabular-nums">{count(user.questionCount)} คำถาม</span>
                <span className="mt-1 block text-xs text-muted-foreground">{count(user.totalTokens)} tokens · {count(user.modelRequestCount)} calls</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function UserRanking({
  label,
  user,
}: {
  label: string;
  user: { userId: string; questionCount: number; totalTokens: number } | undefined;
}) {
  if (!user) return null;
  return (
    <div className="px-5 py-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 truncate font-mono text-sm font-semibold" title={user.userId}>{compactId(user.userId)}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{count(user.questionCount)} <span className="text-sm font-medium text-muted-foreground">คำถาม</span></p>
      <p className="mt-1 text-xs text-muted-foreground">ใช้ {count(user.totalTokens)} tokens</p>
    </div>
  );
}
