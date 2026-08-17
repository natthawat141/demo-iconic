import "server-only";

import { Storage } from "@google-cloud/storage";
import { OAuth2Client } from "google-auth-library";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

import { analyzeTabularData } from "@/lib/tabular-analysis";
import type { TabularCell } from "@/lib/tabular-analysis";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_PDF_STORED_CHARACTERS = 60_000;
const MAX_PDF_PROMPT_CHARACTERS = 24_000;

type UploadKind = "image" | "spreadsheet" | "document";

export type PdfDocumentAnalysis = {
  kind: "pdf";
  pageCount: number;
  extractedText: string;
  extractedCharacters: number;
  truncated: boolean;
  caveats: string[];
};

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
  const inferredMediaType = (
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
  // Windows and some browser integrations report generic MIME types for a
  // perfectly valid local file. The extension is still allow-listed below, so
  // prefer our known extension mapping in that case instead of rejecting it.
  const mediaType = declared && declared !== "application/octet-stream"
    ? declared
    : inferredMediaType;

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
  const command = process.platform === "win32"
    ? process.env.ComSpec ?? "cmd.exe"
    : "gcloud";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "gcloud auth print-access-token"]
    : ["auth", "print-access-token"];
  const accessToken = execFileSync(/* turbopackIgnore: true */ command, args, {
    encoding: "utf8",
    windowsHide: true,
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

export async function downloadFromDemoBucket(objectPath: string) {
  const bucketName = process.env.GCS_UPLOAD_BUCKET?.trim();
  if (!bucketName) throw new Error("ยังไม่ได้ตั้งค่า GCS_UPLOAD_BUCKET");
  const [contents] = await getStorage().bucket(bucketName).file(objectPath).download();
  return contents;
}

export async function deleteFromDemoBucket(objectPath: string) {
  const bucketName = process.env.GCS_UPLOAD_BUCKET?.trim();
  if (!bucketName) throw new Error("ยังไม่ได้ตั้งค่า GCS_UPLOAD_BUCKET");
  await getStorage().bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true });
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

function normalizePdfText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function analyzeUploadedPdf(file: File): Promise<PdfDocumentAnalysis> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    const text = normalizePdfText(extracted.text);
    const truncated = text.length > MAX_PDF_STORED_CHARACTERS;
    const extractedText = text.slice(0, MAX_PDF_STORED_CHARACTERS);
    const caveats: string[] = [];
    if (!extractedText) caveats.push("ไม่พบข้อความที่เลือกอ่านได้ใน PDF นี้ อาจเป็นเอกสารสแกนหรือรูปภาพ");
    if (truncated) caveats.push("เก็บข้อความส่วนต้นไว้เพื่อใช้ประกอบการสนทนาเท่านั้น เพราะเอกสารมีความยาวมาก");
    return {
      kind: "pdf",
      pageCount: extracted.totalPages,
      extractedText,
      extractedCharacters: text.length,
      truncated,
      caveats,
    };
  } finally {
    await pdf?.destroy().catch(() => undefined);
  }
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
  const preview = selected?.previewRows.slice(0, 5).map((row) => row.slice(0, 8).join(" | ")).join("\n") ?? "";
  const numericStats = selected?.columns
    .filter((column) => column.numeric)
    .slice(0, 5)
    .map((column) => `${column.name}: min=${column.numeric!.min}, max=${column.numeric!.max}, sum=${column.numeric!.sum}, avg=${Number(column.numeric!.average.toFixed(2))}`)
    .join("\n") ?? "";
  const chart = analysis.chart ? `${analysis.chart.kind} chart: ${analysis.chart.title}` : "ไม่มีกราฟที่สรุปอย่างปลอดภัย";
  const chartPoints = analysis.chart
    ? analysis.chart.points.map((point) => `${point.label}=${point.value}`).join(", ")
    : "";
  return [
    `ผู้ใช้แนบไฟล์ ${fileName} แล้ว`,
    `มี ${analysis.sheets.length} ชีต; ชีตที่อ่าน: ${selected?.name ?? "-"} (${selected?.rowCount ?? 0} แถว)`,
    `คอลัมน์: ${columns}`,
    numericStats ? `สถิติตัวเลขที่คำนวณแล้ว:\n${numericStats}` : "",
    preview ? `ตัวอย่างแถว (เรียงตามคอลัมน์ข้างต้น):\n${preview}` : "",
    `ข้อเสนอกราฟ: ${chart}`,
    chartPoints ? `ค่าที่ใช้สร้างกราฟ: ${chartPoints}` : "",
    "ช่วยอธิบาย insight ที่ตรวจย้อนกลับได้อย่างกระชับ เสนอคำถามวิเคราะห์ต่อหรือสคริปต์ที่เหมาะกับคอลัมน์จริงเมื่อผู้ใช้ขอ และบอกข้อจำกัดของข้อมูล ห้ามสรุปเกินกว่าข้อมูลนี้",
  ].join("\n");
}

export function pdfPrompt(fileName: string, analysis: PdfDocumentAnalysis) {
  const text = analysis.extractedText.slice(0, MAX_PDF_PROMPT_CHARACTERS);
  const caveats = analysis.caveats.length > 0 ? `ข้อจำกัด: ${analysis.caveats.join(" ")}` : "";
  return [
    `ผู้ใช้แนบ PDF ชื่อ ${fileName} (${analysis.pageCount} หน้า)`,
    text
      ? "ข้อความที่ระบบสกัดได้จาก PDF:\n---\n" + text + "\n---"
      : "PDF นี้ไม่มีข้อความที่ระบบสกัดได้",
    caveats,
    "ตอบจากข้อความในเอกสารนี้และคำถามของผู้ใช้เท่านั้น หากข้อมูลไม่พอให้บอกอย่างตรงไปตรงมา",
  ].filter(Boolean).join("\n\n");
}
