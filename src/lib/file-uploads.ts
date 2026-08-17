import "server-only";

import { Storage } from "@google-cloud/storage";
import { OAuth2Client } from "google-auth-library";
import { execFileSync } from "node:child_process";
import path from "node:path";
import * as XLSX from "xlsx";

import { analyzeTabularData } from "@/lib/tabular-analysis";
import type { TabularCell } from "@/lib/tabular-analysis";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

type UploadKind = "image" | "spreadsheet" | "document";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const spreadsheetTypes = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const documentTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFilename(name: string) {
  const extension = path.extname(name).toLowerCase();
  const stem = path.basename(name, extension)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "upload";
  return `${stem}${extension.slice(0, 12)}`;
}

function extensionFor(file: Pick<File, "name">) {
  return path.extname(file.name).toLowerCase();
}

export function classifyUpload(file: Pick<File, "name" | "type" | "size">): {
  kind: UploadKind;
  mediaType: string;
} {
  if (file.size <= 0) throw new Error("ไฟล์ว่างเปล่า กรุณาเลือกไฟล์ใหม่");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 15 MB");

  const extension = extensionFor(file);
  const declared = file.type.toLowerCase();
  const mediaType = declared || (
    [".jpg", ".jpeg"].includes(extension) ? "image/jpeg"
      : extension === ".png" ? "image/png"
        : extension === ".webp" ? "image/webp"
          : extension === ".gif" ? "image/gif"
            : extension === ".csv" ? "text/csv"
              : extension === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : extension === ".xls" ? "application/vnd.ms-excel"
                  : extension === ".pdf" ? "application/pdf"
                    : extension === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      : "application/octet-stream"
  );

  if (imageTypes.has(mediaType) && [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    if (file.size > 5 * 1024 * 1024) throw new Error("รูปภาพต้องมีขนาดไม่เกิน 5 MB");
    return { kind: "image", mediaType };
  }
  if (spreadsheetTypes.has(mediaType) && [".csv", ".xlsx", ".xls"].includes(extension)) {
    if (file.size > 10 * 1024 * 1024) throw new Error("Excel หรือ CSV ต้องมีขนาดไม่เกิน 10 MB");
    return { kind: "spreadsheet", mediaType };
  }
  if (documentTypes.has(mediaType) && [".pdf", ".docx"].includes(extension)) {
    return { kind: "document", mediaType };
  }
  throw new Error("รองรับ JPEG, PNG, WebP, GIF, CSV, XLSX, XLS, PDF และ DOCX เท่านั้น");
}

function localGcloudStorage() {
  const gcloudCommand = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
  const accessToken = execFileSync(gcloudCommand, ["auth", "print-access-token"], {
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32",
  }).trim();
  if (!accessToken) throw new Error("ไม่พบ Google Cloud access token สำหรับการอัปโหลด");
  const authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: accessToken });
  return new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "aione-zone1",
    authClient,
  });
}

function getStorage() {
  if (process.env.GCS_USE_GCLOUD_USER_AUTH === "true") return localGcloudStorage();
  return new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "aione-zone1" });
}

export async function analyzeUploadedSpreadsheet(file: File) {
  const extension = extensionFor(file);
  if (extension === ".csv") {
    return analyzeTabularData({
      format: "csv",
      content: await file.text(),
      sheetName: "CSV",
    });
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheets = workbook.SheetNames.slice(0, 12).map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name]!, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }).map((row) => (row as unknown[]).map((cell): TabularCell => {
      if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean" || cell == null) return cell;
      return String(cell);
    })),
  }));
  return analyzeTabularData({ format: "workbook", sheets });
}

export async function uploadToDemoBucket(input: {
  id: string;
  userId: string;
  file: File;
  mediaType: string;
}) {
  const bucketName = process.env.GCS_UPLOAD_BUCKET?.trim();
  if (!bucketName) throw new Error("ยังไม่ได้ตั้งค่า GCS_UPLOAD_BUCKET");
  const objectPath = `uploads/${input.userId}/${new Date().toISOString().slice(0, 10)}/${input.id}-${safeFilename(input.file.name)}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());
  await getStorage().bucket(bucketName).file(objectPath).save(bytes, {
    resumable: false,
    contentType: input.mediaType,
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
      metadata: { uploadedBy: input.userId, demoFileId: input.id },
    },
  });
  return { bucketName, objectPath };
}

export function spreadsheetPrompt(fileName: string, analysis: ReturnType<typeof analyzeTabularData>) {
  const selected = analysis.selectedSheet;
  const columns = selected?.columns.slice(0, 8).map((column) => `${column.name} (${column.kind})`).join(", ") ?? "ไม่พบหัวตาราง";
  const chart = analysis.chart ? `${analysis.chart.kind} chart: ${analysis.chart.title}` : "ไม่มีกราฟที่สรุปอย่างปลอดภัย";
  return [
    `ผู้ใช้แนบไฟล์ ${fileName} แล้ว`,
    `มี ${analysis.sheets.length} ชีต; ชีตที่อ่าน: ${selected?.name ?? "-"} (${selected?.rowCount ?? 0} แถว)`,
    `คอลัมน์: ${columns}`,
    `ข้อเสนอกราฟ: ${chart}`,
    "ช่วยอธิบายสิ่งที่อ่านได้อย่างกระชับ โดยบอกข้อจำกัดของข้อมูลถ้ามี และอย่าสรุปเกินกว่าข้อมูลนี้",
  ].join("\n");
}
