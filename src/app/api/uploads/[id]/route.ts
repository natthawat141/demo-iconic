import { activityStorage } from "@/db/activity-storage";
import { getDemoUserForRequest, isValidDemoIdentifier, withDemoSessionCookie } from "@/lib/chat-persistence";
import { deleteFromDemoBucket } from "@/lib/file-uploads";

export const dynamic = "force-dynamic";

function validDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/[\r\n\\/]+/g, "-");
  return name.length >= 1 && name.length <= 160 ? name : null;
}

export async function PATCH(request: Request, context: RouteContext<"/api/uploads/[id]">) {
  const { id } = await context.params;
  const { userId, setCookie } = await getDemoUserForRequest(request);
  if (!isValidDemoIdentifier(id)) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบไฟล์" }, { status: 404 }), setCookie);
  }

  let body: { originalName?: unknown };
  try {
    body = await request.json() as { originalName?: unknown };
  } catch {
    return withDemoSessionCookie(Response.json({ error: "ชื่อไฟล์ไม่ถูกต้อง" }, { status: 400 }), setCookie);
  }
  const originalName = validDisplayName(body.originalName);
  if (!originalName) {
    return withDemoSessionCookie(Response.json({ error: "ชื่อไฟล์ต้องมี 1–160 ตัวอักษร" }, { status: 400 }), setCookie);
  }

  const file = await activityStorage.renameUploadedFile(id, userId, originalName);
  if (!file) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบไฟล์" }, { status: 404 }), setCookie);
  }
  return withDemoSessionCookie(Response.json({ file: { id: file.id, originalName: file.originalName } }), setCookie);
}

export async function DELETE(request: Request, context: RouteContext<"/api/uploads/[id]">) {
  const { id } = await context.params;
  const { userId, setCookie } = await getDemoUserForRequest(request);
  if (!isValidDemoIdentifier(id)) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบไฟล์" }, { status: 404 }), setCookie);
  }
  const file = await activityStorage.getUploadedFile(id);
  if (!file || file.userId !== userId) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบไฟล์" }, { status: 404 }), setCookie);
  }

  try {
    await deleteFromDemoBucket(file.objectPath);
  } catch (error) {
    console.error("Library file delete failed", error);
    return withDemoSessionCookie(Response.json({ error: "ลบไฟล์จาก Cloud Storage ไม่สำเร็จ" }, { status: 502 }), setCookie);
  }
  const deleted = await activityStorage.deleteUploadedFile(id, userId);
  if (!deleted) {
    return withDemoSessionCookie(Response.json({ error: "ไม่พบไฟล์" }, { status: 404 }), setCookie);
  }
  return withDemoSessionCookie(Response.json({ deleted: true }), setCookie);
}
