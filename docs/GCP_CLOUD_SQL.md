# GCP Cloud SQL runbook

เอกสารนี้เป็น source of truth สำหรับ PostgreSQL ของ ICONIC Knowledge Assistant

## Resource ที่สร้างแล้ว

| รายการ | ค่า |
| --- | --- |
| GCP project | `aione-zone1` |
| Cloud SQL instance | `iconic-knowledge-pg` |
| Connection name | `aione-zone1:asia-southeast1:iconic-knowledge-pg` |
| Engine | PostgreSQL 16 |
| Region / zone | `asia-southeast1` / `asia-southeast1-b` |
| Machine | `db-custom-1-3840` (1 vCPU, 3.75 GB RAM) |
| Storage | SSD 10 GB, auto-increase |
| Availability | Zonal |
| Backup | เปิด automated backup และ point-in-time recovery |
| Database | `iconic_knowledge` |
| App user | `iconic_app` |
| Vector extension | `vector` (`pgvector`) |
| Demo upload bucket | `gs://aione-zone1-iconic-demo-50194055876` (`asia-southeast1`) |

รหัสผ่านไม่อยู่ใน Git และเก็บไว้ใน Secret Manager:

- `iconic-db-app-password`
- `iconic-db-admin-password`

Instance นี้เป็นขนาดเริ่มต้นสำหรับ early production และยังไม่ใช่ HA หากเริ่มรับงานที่มี SLA ให้เปลี่ยน availability เป็น regional หลังทดสอบ restore และประเมินค่าใช้จ่ายแล้ว

## เชื่อมต่อจากเครื่องพัฒนา

ติดตั้งและล็อกอิน Google Cloud CLI ก่อน จากนั้นตั้ง Application Default Credentials หนึ่งครั้ง:

```powershell
gcloud auth application-default login
gcloud config set project aione-zone1
```

เปิด Cloud SQL Auth Proxy ใน terminal แยก:

```powershell
cloud-sql-proxy.exe --address 127.0.0.1 --port 5433 aione-zone1:asia-southeast1:iconic-knowledge-pg
```

ตั้ง connection string เฉพาะ process โดยอ่านรหัสจาก Secret Manager:

```powershell
$dbPassword = (gcloud secrets versions access latest --secret=iconic-db-app-password --project=aione-zone1).Trim()
$encodedPassword = [Uri]::EscapeDataString($dbPassword)
$env:POSTGRES_URL = "postgresql://iconic_app:$encodedPassword@127.0.0.1:5433/iconic_knowledge"
pnpm db:seed
pnpm dev
```

อย่าเขียนค่ารหัสผ่านจริงลง `.env.example`, เอกสาร, commit หรือข้อความแชต

## หมายเหตุเรื่อง VM `ai-bot-chatwoot-vm`

VM นี้มีอยู่ก่อนงาน ICONIC และ **ไม่ได้ถูกสร้าง แก้ไข หรือใช้เป็นส่วนหนึ่งของเดโมนี้**. หัวข้อนี้คงไว้เป็นแนวทางเท่านั้น หากในอนาคตต้องนำแอปไป run บน VM ที่มีอยู่แล้ว

หากเลือกใช้ VM ในอนาคต ให้เชื่อมผ่าน Cloud SQL Auth Proxy เพื่อใช้ IAM และ TLS แทนการเปิด authorized network กว้างๆ

Service account ของ VM ต้องมีอย่างน้อย:

- `roles/cloudsql.client`
- `roles/secretmanager.secretAccessor` เฉพาะ secret ของแอป

รัน proxy เป็น service/sidecar ที่ bind เฉพาะ `127.0.0.1:5432` แล้วประกอบ `POSTGRES_URL` จาก Secret Manager ตอน start process ไม่เก็บ password ใน image

## ลำดับการเลือก storage ในแอป

1. `POSTGRES_URL` / `POSTGRES_HOST` — GCP Cloud SQL PostgreSQL (production system of record พร้อม pgvector)
2. ไม่มีค่าดังกล่าว — SQLite local demo (`data/demo.sqlite` สำหรับการพัฒนาในเครื่อง)
*(หมายเหตุ: เลิกใช้งาน Oracle MySQL adapter เดิมแล้วเพื่อความเรียบง่ายของระบบ)*

เมื่อ PostgreSQL เชื่อมต่อครั้งแรก แอปจะสร้างตารางและ seed demo data ให้อัตโนมัติ Embedding เก็บในคอลัมน์ชนิด `vector` ของ pgvector ปัจจุบันใช้ `openai/text-embedding-3-small` ขนาด 1,536 มิติ และมี HNSW cosine index ชื่อ `idx_chunks_embedding_hnsw`; หากเปลี่ยนโมเดล ระบบ rebuild chunks และ index ตาม dimension ใหม่

ไฟล์รูป, Excel, CSV, PDF และ DOCX ของเดโมเก็บ binary ใน Cloud Storage bucket ข้างต้น; PostgreSQL เก็บเฉพาะ metadata, user/conversation ID และผลวิเคราะห์ตารางที่ serialize ได้

## ตรวจสอบระบบ

```powershell
gcloud sql instances describe iconic-knowledge-pg --project=aione-zone1
gcloud sql backups list --instance=iconic-knowledge-pg --project=aione-zone1
gcloud secrets versions list iconic-db-app-password --project=aione-zone1
```

หลังเปิด proxy ตรวจ extension และจำนวนข้อมูล:

```powershell
$env:PGPASSWORD = (gcloud secrets versions access latest --secret=iconic-db-app-password --project=aione-zone1).Trim()
psql -h 127.0.0.1 -p 5433 -U iconic_app -d iconic_knowledge -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
psql -h 127.0.0.1 -p 5433 -U iconic_app -d iconic_knowledge -c "SELECT COUNT(*) FROM knowledge_items;"
Remove-Item Env:PGPASSWORD
```

## ก่อนขึ้น production จริง

- เปิด deletion protection
- ทดสอบ restore จาก backup ไป instance ชั่วคราว
- เปลี่ยนเป็น Regional HA หากลูกค้าต้องการ SLA
- จำกัด Secret Manager IAM ให้ service account ของแอปเท่านั้น
- ทดสอบ recall/latency ก่อนเปลี่ยน embedding model หรือ HNSW parameters
- เปิด Query Insights/alerts สำหรับ CPU, memory, storage และ connection count
