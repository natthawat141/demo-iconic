import { GapList } from "@/components/gap-list";
import { PageHeader } from "@/components/page-header";
import { listGaps } from "@/lib/knowledge";
import { serializeGap } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export default async function GapsPage() {
  const gaps = (await listGaps()).map(serializeGap);
  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Knowledge Gaps"
        description="คำถามที่น้องฟ้ายังตอบไม่ได้จะมารวมที่นี่ เพื่อให้หัวหน้าทีมตอบหนึ่งครั้งและเปลี่ยนเป็นความรู้ที่ใช้ซ้ำได้"
      />
      <GapList initialGaps={gaps} />
    </div>
  );
}
