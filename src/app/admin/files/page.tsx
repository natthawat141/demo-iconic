import { BarChart3, FileText, ImageIcon, Table2 } from "lucide-react";

import { activityStorage } from "@/db/activity-storage";

export const dynamic = "force-dynamic";

const iconFor = { image: ImageIcon, spreadsheet: Table2, document: FileText };

export default async function AdminFilesPage() {
  const files = await activityStorage.listUploadedFiles(150);
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-semibold text-primary">CLOUD STORAGE</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">ไฟล์และการวิเคราะห์</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">ไฟล์จริงอยู่ใน Google Cloud Storage; ฐานข้อมูลเก็บเฉพาะ metadata, ผู้ใช้ และผลสรุปที่แสดงในเดโม</p>
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {files.length === 0 ? <div className="px-5 py-12 text-center text-sm text-muted-foreground">ยังไม่มีไฟล์อัปโหลด</div> : files.map((file) => {
          const Icon = iconFor[file.kind];
          const chart = file.analysis?.chart as { title?: string; points?: unknown[] } | undefined;
          return (
            <div key={file.id} className="flex gap-3 border-b border-border px-5 py-4 last:border-b-0">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.originalName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{file.kind} · {(file.sizeBytes / 1024).toFixed(1)} KB · {file.status} · {file.createdAt.toLocaleString("th-TH")}</p>
                {chart?.title ? <p className="mt-2 flex items-center gap-1.5 text-xs text-primary"><BarChart3 className="size-3.5" /> {chart.title} · {chart.points?.length ?? 0} จุดข้อมูล</p> : null}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
