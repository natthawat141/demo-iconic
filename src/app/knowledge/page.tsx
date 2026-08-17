import Link from "next/link";
import { Plus } from "lucide-react";

import { KnowledgeList } from "@/components/knowledge-list";
import { PageHeader } from "@/components/page-header";
import { listKnowledge } from "@/lib/knowledge";
import { serializeKnowledge } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  const items = listKnowledge().map(serializeKnowledge);
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="คลังความรู้"
        description="จัดการเนื้อหาที่น้องฟ้าใช้ตอบทีม เฉพาะรายการ Approved เท่านั้นที่จะถูกนำไปค้นและอ้างอิง"
        actions={
          <Link
            href="/knowledge/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[oklch(0.49_0.17_24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" /> เพิ่ม Knowledge
          </Link>
        }
      />
      <KnowledgeList items={items} />
    </div>
  );
}
