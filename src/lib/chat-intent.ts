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
const workplaceHelpPattern = /(?:อะไร|ข้อมูล).{0,20}(?:ใช้(?:ได้)?|ทำ(?:ได้)?|จัดการ).{0,20}(?:ระบบ|ทีม)|(?:ระบบ|ทีม).{0,20}(?:ใช้(?:ได้)?|ทำ(?:ได้)?|จัดการ).{0,20}(?:อะไร|งาน)/iu;
const identityPattern = /^(คุณคือใคร|เธอคือใคร|น้องฟ้าคือใคร|who are you|what are you)$/iu;
const overviewPattern = /(ภาพรวม.*knowledge|knowledge.*ภาพรวม|สรุป.*knowledge|knowledge.*สรุป|dashboard|สถิติ.*knowledge|knowledge.*(?:chart|graph|กราฟ|แผนภูมิ)|(?:chart|graph|กราฟ|แผนภูมิ).*knowledge)/iu;
const visualizationPattern = /(chart|graph|กราฟ|แผนภูมิ|visuali[sz]e|แนวโน้ม)/iu;
const explicitWebPattern = /(ค้น(?:หา)?|เสิร์ช|search|ดู).{0,20}(เว็บ|อินเทอร์เน็ต|internet|web|ออนไลน์)|(?:เว็บ|อินเทอร์เน็ต|internet|web).{0,20}(ค้น(?:หา)?|เสิร์ช|search)/iu;
const publicProfilePattern = /(?:ค้น(?:หา)?|เสิร์ช|search).{0,100}(?:คือใคร|ประวัติ|who is)/iu;
const publicLookupPattern = /^(?:ช่วย)?(?:ค้น(?:หา)?|เสิร์ช|search|หา)\s*(?:ข้อมูล)?\s*.+/iu;
const freshPublicInfoPattern = /(?:ข่าว|ราคา|หุ้น|ตลาด|อากาศ|เทรนด์|เทคโนโลยี|บริษัท|ผลิตภัณฑ์|กฎหมาย|ประกาศ|next\.js|react).{0,40}(?:ล่าสุด|วันนี้|ตอนนี้|ปัจจุบัน|current|latest|today)|(?:ล่าสุด|วันนี้|ตอนนี้|ปัจจุบัน|current|latest|today).{0,40}(?:ข่าว|ราคา|หุ้น|ตลาด|อากาศ|เทรนด์|เทคโนโลยี|บริษัท|ผลิตภัณฑ์|กฎหมาย|ประกาศ|next\.js|react)/iu;
const internalContextPattern = /(iconic|น้องฟ้า|knowledge|ทีม(?:เรา)?|ของเรา|ของระบบเรา|ระบบ(?:ของ)?(?:เรา|ทีม)|ลูกค้า|กรมธรรม์|แนวทางขาย|ติดตามลูกค้า|หัวหน้าทีม)/iu;
const generalDefinitionPattern = /^(api|apis|ฐานข้อมูล|database|rag|vector database|markdown|excel|csv)\s*(คืออะไร|คืออะไรครับ|คืออะไรคะ|หมายความว่าอะไร|what is)/iu;
const ambiguousWorkPattern = /^(?:แล้ว\s*)?(api|ขั้นตอน|นโยบาย|ข้อมูล|ระบบ|knowledge)\s*(ล่ะ|คืออะไร|หมายถึงอะไร|ยังไง)?$/iu;

function workplaceHelpReply() {
  return `น้องฟ้าช่วยงานที่ทีมต้องทำต่อได้ เช่น

- **ติดตามลูกค้า** — ร่างข้อความ follow-up และดูแนวทางเมื่อยังไม่ได้รับคำตอบ
- **เตรียมคุยกับลูกค้า** — สรุปข้อมูลหรือเช็กลิสต์ก่อนพบลูกค้า
- **รับมือคำถามและข้อกังวล** — ค้นแนวทางตอบจาก Knowledge ที่ทีมอนุมัติแล้ว
- **งานเอกสารและเบิกจ่าย** — ดูขั้นตอน เอกสารที่ต้องแนบ และเงื่อนไขที่เกี่ยวข้อง
- **Onboarding ทีม** — เช็กสิ่งที่พนักงานใหม่ต้องเตรียมในวันแรก
- **วิเคราะห์ไฟล์งาน** — แนบ Excel หรือ CSV แล้วให้สรุปแนวโน้มและสร้างกราฟได้
- **ค้นเอกสาร** — แนบ PDF หรือรูป แล้วถามเฉพาะประเด็นที่ต้องการได้

ลองเริ่มจาก “ลูกค้าไม่ตอบหลังส่งแผน ควรติดตามอย่างไร” หรือ “ช่วยสรุปค่าใช้จ่ายจากไฟล์นี้” ได้เลยค่ะ`;
}

export type ChatIntent = "smalltalk" | "general" | "knowledge" | "overview" | "visualize" | "web" | "ambiguous";

export function conversationalReply(message: string) {
  const normalized = normalizeMessage(message);

  if (greetingPattern.test(normalized)) {
    return "สวัสดีค่ะ น้องฟ้าเอง วันนี้อยากให้ช่วยค้นเรื่องไหน หรืออยากลองดูภาพรวม Knowledge ของทีมก็ได้ค่ะ";
  }

  if (thanksPattern.test(normalized)) {
    return "ยินดีค่ะ ถ้ามีคำถามต่อ ลองพิมพ์สถานการณ์หรือขั้นตอนที่ต้องการค้นหาได้เลยนะคะ";
  }

  if (helpPattern.test(normalized) || workplaceHelpPattern.test(normalized)) {
    return workplaceHelpReply();
  }

  if (identityPattern.test(normalized)) {
    return "น้องฟ้าเป็นผู้ช่วยความรู้ของทีม ICONIC ค่ะ หน้าที่คือช่วยเปิดคลังความรู้ หาเอกสารที่เกี่ยวข้อง สรุปให้เข้าใจง่าย และไม่เดาคำตอบเมื่อข้อมูลยังไม่พอ";
  }

  return null;
}

export function classifyChatIntent(message: string, previousContext = ""): ChatIntent {
  const normalized = normalizeMessage(message);
  if (conversationalReply(message)) return "smalltalk";
  if (explicitWebPattern.test(normalized)) return "web";
  if (overviewPattern.test(normalized)) return "overview";
  if (visualizationPattern.test(normalized)) return "visualize";
  if (internalContextPattern.test(normalized)) return "knowledge";
  if (publicProfilePattern.test(normalized) || publicLookupPattern.test(normalized) || freshPublicInfoPattern.test(normalized)) return "web";
  if (generalDefinitionPattern.test(normalized)) return "general";
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
