import { activityStorage } from "@/db/activity-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  try {
    const files = await activityStorage.listUploadedFiles(300);
    return Response.json({
      files: files.map((file) => ({
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
      })),
    });
  } catch (error) {
    console.error("Failed to list admin files", error);
    return Response.json({ error: "ไม่สามารถโหลดรายการไฟล์ได้" }, { status: 500 });
  }
}
