import { activityStorage } from "@/db/activity-storage";
import { AdminFilesView } from "@/components/admin-files-view";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  const files = await activityStorage.listUploadedFiles(300);
  const serializedFiles = files.map((file) => ({
    id: file.id,
    userId: file.userId,
    conversationId: file.conversationId,
    originalName: file.originalName,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    objectPath: file.objectPath,
    kind: file.kind,
    status: file.status,
    analysis: file.analysis,
    createdAt: file.createdAt.toISOString(),
  }));

  return <AdminFilesView initialFiles={serializedFiles} />;
}

