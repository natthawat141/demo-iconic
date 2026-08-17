import Link from "next/link";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import type { SourceMessagePartComponent } from "@assistant-ui/react";

export const KnowledgeSource: SourceMessagePartComponent = ({
  sourceType,
  title,
  url,
}) => {
  if (sourceType !== "url" || !url) return null;
  return (
    <Link
      href={url}
      className="mt-3 flex min-h-14 items-center gap-3 rounded-xl bg-[oklch(0.97_0.025_225)] px-3 py-2.5 text-[oklch(0.26_0.05_235)] transition-colors hover:bg-[oklch(0.93_0.045_225)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-[oklch(0.43_0.11_235)]">
        <BookOpenText className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[oklch(0.43_0.11_235)]">
          แหล่งข้อมูลที่ใช้ตอบ
        </span>
        <span className="block truncate text-sm font-semibold">
          {title ?? "เปิด Knowledge"}
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
};
