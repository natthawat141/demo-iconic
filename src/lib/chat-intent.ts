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

export function conversationalReply(message: string) {
  const normalized = normalizeMessage(message);

  if (greetingPattern.test(normalized)) {
    return "สวัสดีครับ ผมช่วยค้นหาคำตอบจาก Knowledge ที่ทีมอนุมัติแล้ว ลองถามเรื่องการดูแลลูกค้า การติดตามงาน หรือขั้นตอนของทีมได้เลย";
  }

  if (thanksPattern.test(normalized)) {
    return "ยินดีครับ หากมีคำถามต่อ ลองพิมพ์สถานการณ์หรือขั้นตอนที่ต้องการค้นหาได้เลย";
  }

  if (helpPattern.test(normalized)) {
    return "ผมช่วยค้นหาความรู้ที่ทีมอนุมัติแล้ว แสดงแหล่งข้อมูลที่ใช้ตอบ และส่งคำถามที่ยังไม่มีข้อมูลให้หัวหน้าทีมจัดการต่อได้";
  }

  return null;
}
