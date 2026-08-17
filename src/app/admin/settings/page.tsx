import { Cpu, Database, KeyRound, ShieldCheck } from "lucide-react";

import { isPostgresConfigured } from "@/db/postgres-config";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const rows = [
    {
      icon: Cpu,
      label: "Chat model",
      value: process.env.OPENROUTER_CHAT_MODEL ?? "openai/gpt-4.1-mini",
      detail: "โหลดจาก OPENROUTER_CHAT_MODEL",
    },
    {
      icon: Database,
      label: "Embedding model",
      value: process.env.OPENROUTER_EMBEDDING_MODEL ?? "local-hash-v1",
      detail: "ใช้สร้างดัชนีสำหรับค้น Knowledge",
    },
    {
      icon: Database,
      label: "Database",
      value: isPostgresConfigured() ? "GCP Cloud SQL · PostgreSQL" : process.env.MYSQL_URL ? "Oracle MySQL" : "SQLite local demo",
      detail: isPostgresConfigured() ? "PostgreSQL + pgvector เป็น system of record" : process.env.MYSQL_URL ? "เชื่อมต่อผ่าน MYSQL_URL" : "ใช้ฐานในเครื่องสำหรับ development",
    },
    {
      icon: KeyRound,
      label: "Provider status",
      value: process.env.OPENROUTER_API_KEY ? "Connected" : "Demo safe mode",
      detail: "ระบบไม่แสดง API key บนหน้าเว็บ",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-border pb-6">
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></div>
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Runtime configuration</h1>
        <p className="mt-2 text-sm text-muted-foreground">ค่าที่ใช้จริงจาก environment โดยไม่เปิดเผย credential</p>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="grid gap-3 border-b border-border p-5 last:border-b-0 sm:grid-cols-[180px_1fr]">
              <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{row.label}</div>
              <div>
                <code className="break-all font-mono text-sm">{row.value}</code>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
