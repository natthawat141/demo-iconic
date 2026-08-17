# Nong Fah — ICONIC Knowledge Assistant Demo

เดโมผู้ช่วยความรู้ภายในที่แสดงวงจร Knowledge Management ครบตั้งแต่ถาม–ตอบด้วยแหล่งอ้างอิง ไปจนถึงบันทึกคำถามที่ตอบไม่ได้เป็น Knowledge Gap แล้วแปลงเป็นความรู้ใหม่เพื่ออนุมัติและใช้ซ้ำ

## สิ่งที่เดโมทำได้

- แชตภาษาไทยบน `assistant-ui` พร้อมสถานะ grounded/safe demo และ Source Cards
- ใช้เฉพาะ Knowledge สถานะ `Approved` ในการตอบ
- สร้าง แก้ไข อนุมัติ เก็บถาวร และกำหนด owner/source/review date
- รวมคำถามที่ตอบไม่ได้เป็น Knowledge Gaps พร้อมจำนวนครั้งที่ถูกถาม
- ส่งต่อหัวหน้าทีม แปลง Gap เป็น Draft Knowledge แล้วอนุมัติเพื่อใช้ตอบรอบถัดไป
- รีเซ็ตข้อมูลกลับสู่ sales-demo scenario ได้ในคลิกเดียว

ข้อมูล seed ทั้งหมดเป็นข้อมูลสมมติสำหรับเดโม ไม่ใช่นโยบายจริงของ ICONIC

## เริ่มใช้งาน

ต้องมี Node.js 20+ และ pnpm

```bash
pnpm install
pnpm db:seed
pnpm dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## OpenRouter

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ API key ผ่านไฟล์ในเครื่อง:

```dotenv
OPENROUTER_API_KEY=your-key
OPENROUTER_CHAT_MODEL=openai/gpt-4.1-mini
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
DEMO_SAFE_MODE=false
```

หากไม่มี key หรือ `DEMO_SAFE_MODE=true` ระบบยังทำงานได้ด้วยคำตอบจาก Knowledge ที่ค้นพบและ local hash embeddings แบบ deterministic เหมาะสำหรับการพรีเซนต์โดยไม่พึ่งอินเทอร์เน็ต

## ตรวจคุณภาพ

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

SQLite ถูกเก็บที่ `data/demo.sqlite` และไม่ถูก commit ขึ้น Git ใช้ `pnpm db:seed` หรือปุ่ม “รีเซ็ตเดโม” เพื่อคืนข้อมูลเริ่มต้น

อ่านขอบเขตและ acceptance criteria ที่ [DEMO_SPEC.md](./DEMO_SPEC.md)
