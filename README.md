# Nong Fah — ICONIC Knowledge Assistant

เดโมผู้ช่วย AI ภาษาไทยสำหรับทีม ICONIC: คุยเรื่องทั่วไปได้, ค้นข้อมูลปัจจุบันจากเว็บ, ตอบข้อมูลภายในจาก Approved Knowledge พร้อมแหล่งอ้างอิง, วิเคราะห์รูป/PDF/CSV/Excel และเก็บประวัติแชต/ไฟล์แยกตามผู้ใช้ให้ Admin ตรวจได้

ข้อมูล Knowledge และไฟล์ตัวอย่างทั้งหมดเป็นข้อมูลสมมติสำหรับเดโม ไม่ใช่นโยบายหรือข้อมูลลูกค้าจริง

Demo บน Cloud Run: [iconic-knowledge-assistant](https://iconic-knowledge-assistant-50194055876.asia-southeast1.run.app)

## สิ่งที่ทดลองได้

- แชตแบบ `assistant-ui` รองรับ Markdown, code blocks, ตาราง, Source Cards และกราฟ
- แยก intent: สนทนาทั่วไป, Knowledge ภายใน, คำถามกำกวม, ข้อมูลล่าสุดจากเว็บ และการวิเคราะห์ไฟล์
- Tavily web search สำหรับข่าว ราคา รุ่นซอฟต์แวร์ และข้อมูลสาธารณะที่เปลี่ยนแปลงได้
- OpenRouter สำหรับ chat/vision/embedding โดยอ่านชื่อโมเดลจาก environment
- อัปโหลดรูป, PDF, CSV, XLS/XLSX และ DOCX ไป Google Cloud Storage แบบ private
- อ่านข้อความ PDF, สรุปคอลัมน์/สถิติ/ตัวอย่างแถว และสร้าง bar/line chart จาก CSV/Excel
- เขียน Markdown, โค้ดหรือสคริปต์สั้นจากชื่อคอลัมน์ที่อ่านได้จริง
- ฟังคำตอบภาษาไทย/อังกฤษผ่าน Web Speech API ของเบราว์เซอร์
- Clerk sign in/sign up และประวัติแชต/ไฟล์/usage แยกตาม user ID
- ความจำข้ามบทสนทนาแบบ per-user: เพิ่ม/ตรวจ/ลบได้ที่ `/memory` และค้นเฉพาะบริบทที่เกี่ยวข้องก่อนตอบ
- Admin workspace: ผู้ใช้, บทสนทนา, ไฟล์, token/model usage, Knowledge lifecycle, gaps และ Admin AI
- Hybrid Knowledge retrieval: OpenRouter embeddings + lexical Thai matching; PostgreSQL ใช้ pgvector และ HNSW candidate search

## เริ่มใช้งานบนเครื่อง

ต้องมี Node.js 20+ และ pnpm

```powershell
pnpm install
pnpm dev --port 3001
```

เปิด [http://localhost:3001](http://localhost:3001) หากไม่ต่อ PostgreSQL ระบบจะใช้ `data/demo.sqlite` อัตโนมัติ

ไฟล์ CSV ตัวอย่างอยู่ที่ `public/demo-data/` และดาวน์โหลดได้จากหน้า `/library`

## Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจริงเฉพาะในเครื่อง ห้าม commit secrets

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_CHAT_MODEL=google/gemini-3.7-flash
OPENROUTER_VISION_MODEL=
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
TAVILY_API_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

GCS_UPLOAD_BUCKET=aione-zone1-iconic-demo-50194055876
GOOGLE_CLOUD_PROJECT=aione-zone1
```

`Tavily_api_key` ยังรองรับชั่วคราวเพื่อไม่ทำลาย env เดิม แต่ชื่อมาตรฐานที่ควรใช้คือ `TAVILY_API_KEY`

## Database

Local ผ่าน Cloud SQL Auth Proxy ใช้ URL เดียวได้:

```dotenv
POSTGRES_URL=postgresql://iconic_app:password@127.0.0.1:5433/iconic_knowledge
```

Cloud Run ใช้ Cloud SQL Unix socket และ inject password จาก Secret Manager แยกจาก image:

```dotenv
POSTGRES_HOST=/cloudsql/aione-zone1:asia-southeast1:iconic-knowledge-pg
POSTGRES_PORT=5432
POSTGRES_DB=iconic_knowledge
POSTGRES_USER=iconic_app
POSTGRES_PASSWORD=<Secret Manager>
```

ระบบเลือก storage ตามลำดับ PostgreSQL → optional MySQL compatibility → local SQLite รายละเอียด resource และวิธีตรวจฐานอยู่ที่ [docs/GCP_CLOUD_SQL.md](./docs/GCP_CLOUD_SQL.md)

## ตรวจคุณภาพ

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Health endpoint: `/api/health`

## Deployment

มี `Dockerfile` แบบ Next.js standalone สำหรับ Cloud Run และไฟล์ ignore ที่ไม่ส่ง `.env`, SQLite, build cache หรือ dependencies เข้า Cloud Build ดูขั้นตอนและ IAM ที่ [docs/GCP_CLOUD_RUN.md](./docs/GCP_CLOUD_RUN.md)

ขอบเขต UX อยู่ที่ [docs/UX_IMPLEMENTATION_PLAN.md](./docs/UX_IMPLEMENTATION_PLAN.md) และรายการที่เลื่อนไป production อยู่ที่ [docs/PRODUCTION_DEFERRED.md](./docs/PRODUCTION_DEFERRED.md)

รายละเอียด memory, privacy boundary และสิ่งที่ตั้งใจเลื่อนไป production อยู่ที่ [docs/USER_MEMORY.md](./docs/USER_MEMORY.md)
