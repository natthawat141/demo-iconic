import { activityStorage } from "@/db/activity-storage";
import { downloadFromDemoBucket } from "@/lib/file-uploads";
import { getDemoUserForRequest, withDemoSessionCookie } from "@/lib/chat-persistence";

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "download";
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, context: RouteContext<"/api/uploads/[id]/content">) {
  const { id } = await context.params;
  const { setCookie } = await getDemoUserForRequest(request);
  const file = await activityStorage.getUploadedFile(id);
  if (!file) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบไฟล์" }, { status: 404 }), setCookie);
  }

  try {
    const contents = await downloadFromDemoBucket(file.objectPath);
    // `Buffer` is a Node-specific Uint8Array subtype; copy it into a web
    // Uint8Array so the Route Handler response stays compatible with BodyInit.
    const body = new Uint8Array(contents);
    return withDemoSessionCookie(new Response(body, {
      headers: {
        "Content-Type": file.mediaType,
        "Content-Disposition": contentDisposition(file.originalName),
        "Cache-Control": "private, no-store",
      },
    }), setCookie);
  } catch (error) {
    console.error("Library file preview failed", error);
    return withDemoSessionCookie(Response.json({ error: "ยังเปิดไฟล์นี้จาก Cloud Storage ไม่ได้" }, { status: 502 }), setCookie);
  }
}
