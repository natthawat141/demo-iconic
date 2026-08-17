import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, withDemoSessionCookie } from "@/lib/chat-persistence";
import {
  analyzeUploadedSpreadsheet,
  classifyUpload,
  spreadsheetPrompt,
  uploadToDemoBucket,
} from "@/lib/file-uploads";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId, setCookie } = await getDemoUserForRequest(request);
  const files = await activityStorage.listUploadedFilesForUser(userId, 150);
  return withDemoSessionCookie(
    Response.json({
      files: files.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        mediaType: file.mediaType,
        sizeBytes: file.sizeBytes,
        kind: file.kind,
        status: file.status,
        analysis: file.analysis,
        createdAt: file.createdAt.toISOString(),
      })),
    }),
    setCookie,
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "กรุณาเลือกไฟล์ก่อนอัปโหลด" }, { status: 400 });
  }

  let classified: ReturnType<typeof classifyUpload>;
  try {
    classified = classifyUpload(file);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "ไฟล์นี้ไม่รองรับ" },
      { status: 400 },
    );
  }

  const { userId, setCookie } = await getDemoUserForRequest(request);
  let analysis: Record<string, unknown> | null = null;
  if (classified.kind === "spreadsheet") {
    try {
      analysis = await analyzeUploadedSpreadsheet(file) as unknown as Record<string, unknown>;
    } catch (error) {
      return withDemoSessionCookie(
        Response.json(
          { error: error instanceof Error ? `อ่านตารางไม่สำเร็จ: ${error.message}` : "อ่านตารางไม่สำเร็จ" },
          { status: 422 },
        ),
        setCookie,
      );
    }
  }

  const id = crypto.randomUUID();
  try {
    const uploaded = await uploadToDemoBucket({ id, userId, file, mediaType: classified.mediaType });
    await activityStorage.createUploadedFile({
      id,
      userId,
      conversationId: null,
      originalName: file.name,
      mediaType: classified.mediaType,
      sizeBytes: file.size,
      objectPath: uploaded.objectPath,
      kind: classified.kind,
      status: classified.kind === "spreadsheet" ? "analyzed" : "uploaded",
      analysis,
    });
  } catch (error) {
    console.error("File upload failed", error);
    return withDemoSessionCookie(
      Response.json({ error: "อัปโหลดไฟล์ไปยัง Cloud Storage ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 }),
      setCookie,
    );
  }

  const prompt = classified.kind === "spreadsheet" && analysis
    ? spreadsheetPrompt(file.name, analysis as unknown as Parameters<typeof spreadsheetPrompt>[1])
    : `ผู้ใช้แนบไฟล์ ${file.name} (${classified.mediaType}) แล้ว ช่วยยืนยันว่าได้รับไฟล์และบอกว่าพร้อมใช้ไฟล์นี้ประกอบการสนทนา`;

  return withDemoSessionCookie(
    Response.json({
      upload: {
        id,
        filename: file.name,
        mediaType: classified.mediaType,
        kind: classified.kind,
        analysis,
        prompt,
      },
    }),
    setCookie,
  );
}
