import Link from "next/link";
import { Plus } from "lucide-react";

import { KnowledgeList } from "@/components/knowledge-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
          <Button
            render={<Link href="/knowledge/new" />}
            nativeButton={false}
            size="lg"
            className="h-11 px-4"
          >
            <Plus className="size-4" /> เพิ่ม Knowledge
          </Button>
        }
      />
      <KnowledgeList items={items} />
    </div>
  );
}
