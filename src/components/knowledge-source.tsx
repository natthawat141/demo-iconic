import Link from "next/link";
import { ArrowUpRight, BookOpenText, Globe2 } from "lucide-react";
import type { SourceMessagePartComponent } from "@assistant-ui/react";

export const KnowledgeSource: SourceMessagePartComponent = ({
  sourceType,
  title,
  url,
}) => {
  if (sourceType !== "url" || !url) return null;
  const external = /^https?:\/\//i.test(url);
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary ring-1 ring-border">
        {external ? <Globe2 className="size-4" aria-hidden="true" /> : <BookOpenText className="size-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-primary">
          {external ? "แหล่งข้อมูลจากเว็บ" : "แหล่งข้อมูลที่ใช้ตอบ"}
        </span>
        <span className="block truncate text-sm font-semibold">
          {title ?? (external ? "เปิดหน้าเว็บ" : "เปิด Knowledge")}
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
    </>
  );
  const className = "mt-3 flex min-h-14 items-center gap-3 rounded-xl border border-primary/15 bg-primary/8 px-3 py-2.5 text-foreground transition-colors hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (external) return (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  );
  return (
    <Link href={url} className={className}>
      {content}
    </Link>
  );
};
