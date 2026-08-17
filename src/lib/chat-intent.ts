function normalizeMessage(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("th")
    .replace(/[!！?？.,。]+$/gu, "")
    .trim();
}

const greetingPattern = /^(hi|hello|hey|yo|สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|ดีคะ|สวัสดีครับ|สวัสดีค่ะ)$/iu;
const thanksPattern = /^(ขอบคุณ|ขอบคุณครับ|ขอบคุณค่ะ|thanks|thank you|โอเค|ok|okay)$/iu;
const helpPattern = /^(ช่วยอะไรได้บ้าง|ทำอะไรได้บ้าง|คุณทำอะไรได้บ้าง|ใช้ยังไง|how can you help|what can you do)$/iu;
const identityPattern = /^(คุณคือใคร|เธอคือใคร|น้องฟ้าคือใคร|who are you|what are you)$/iu;
const overviewPattern = /(ภาพรวม|สรุป.*knowledge|knowledge.*สรุป|dashboard|chart|กราฟ|สถิติ.*knowledge)/iu;
const internalContextPattern = /(iconic|น้องฟ้า|knowledge|ทีม(?:เรา)?|ของเรา|ของระบบเรา|ระบบ(?:ของ)?(?:เรา|ทีม)|ลูกค้า|กรมธรรม์|แนวทางขาย|ติดตามลูกค้า|หัวหน้าทีม)/iu;
const generalDefinitionPattern = /^(api|apis|ฐานข้อมูล|database|rag|vector database|markdown|excel|csv)\s*(คืออะไร|คืออะไรครับ|คืออะไรคะ|หมายความว่าอะไร|what is)/iu;
const ambiguousWorkPattern = /^(api|ขั้นตอน|นโยบาย|ข้อมูล|ระบบ|knowledge)\s*(ล่ะ|คืออะไร|หมายถึงอะไร|ยังไง)?$/iu;

export type ChatIntent = "smalltalk" | "general" | "knowledge" | "overview" | "ambiguous";

export function conversationalReply(message: string) {
  const normalized = normalizeMessage(message);

  if (greetingPattern.test(normalized)) {
    return "สวัสดีค่ะ น้องฟ้าเอง วันนี้อยากให้ช่วยค้นเรื่องไหน หรืออยากลองดูภาพรวม Knowledge ของทีมก็ได้ค่ะ";
  }

  if (thanksPattern.test(normalized)) {
    return "ยินดีค่ะ ถ้ามีคำถามต่อ ลองพิมพ์สถานการณ์หรือขั้นตอนที่ต้องการค้นหาได้เลยนะคะ";
  }

  if (helpPattern.test(normalized)) {
    return "น้องฟ้าช่วยค้นและสรุปความรู้ที่ทีมอนุมัติแล้ว พร้อมเปิดแหล่งข้อมูลให้ตรวจสอบได้ ถ้าคำถามยังไม่มีคำตอบตรงๆ จะบอกตามจริง แนะนำเรื่องที่ใกล้เคียง และส่งต่อเป็น Knowledge Gap ให้ทีมจัดการค่ะ";
  }

  if (identityPattern.test(normalized)) {
    return "น้องฟ้าเป็นผู้ช่วยความรู้ของทีม ICONIC ค่ะ หน้าที่คือช่วยเปิดคลังความรู้ หาเอกสารที่เกี่ยวข้อง สรุปให้เข้าใจง่าย และไม่เดาคำตอบเมื่อข้อมูลยังไม่พอ";
  }

  return null;
}

export function classifyChatIntent(message: string, previousContext = ""): ChatIntent {
  const normalized = normalizeMessage(message);
  if (conversationalReply(message)) return "smalltalk";
  if (overviewPattern.test(normalized)) return "overview";
  if (generalDefinitionPattern.test(normalized)) return "general";
  if (internalContextPattern.test(normalized)) return "knowledge";
  if (ambiguousWorkPattern.test(normalized)) {
    return internalContextPattern.test(previousContext) ? "knowledge" : "ambiguous";
  }
  return "general";
}

export function ambiguousContextReply(message: string) {
  const normalized = normalizeMessage(message);
  if (/api|ระบบ/iu.test(normalized)) {
    return "หมายถึง API หรือระบบในความหมายทั่วไป หรือของระบบ ICONIC คะ? ถ้าเป็นของทีม น้องฟ้าจะเปิด Knowledge ที่เกี่ยวข้องให้ค่ะ";
  }
  return "เรื่องนี้หมายถึงข้อมูลทั่วไป หรือบริบทการทำงานของทีม ICONIC คะ? บอกเพิ่มอีกนิด น้องฟ้าจะช่วยต่อให้ตรงค่ะ";
}
