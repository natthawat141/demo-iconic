# GCP Cloud Run runbook

Cloud Run เป็น runtime ของเว็บ ส่วน Cloud SQL และ Cloud Storage เป็นบริการแยก ไม่มี VM ของ ICONIC เพิ่มใน architecture นี้

## Resource target

| รายการ | ค่า |
| --- | --- |
| Project | `aione-zone1` |
| Region | `asia-southeast1` |
| Service | `iconic-knowledge-assistant` |
| Cloud SQL | `aione-zone1:asia-southeast1:iconic-knowledge-pg` |
| Upload bucket | `aione-zone1-iconic-demo-50194055876` |
| DB password secret | `iconic-db-app-password` |

Public demo: [iconic-knowledge-assistant](https://iconic-knowledge-assistant-50194055876.asia-southeast1.run.app)

## Runtime configuration

Container ใช้ Next.js standalone บน port `8080` และเชื่อม Cloud SQL ผ่าน Unix socket ที่ Cloud Run mount ให้ ไม่เปิด IP ของฐานเพิ่ม

ค่าที่เป็น secret ต้อง inject จาก Secret Manager เท่านั้น:

- `POSTGRES_PASSWORD` ← `iconic-db-app-password:latest`
- `OPENROUTER_API_KEY`
- `TAVILY_API_KEY`
- `CLERK_SECRET_KEY`

ค่าที่ไม่ลับ:

- `POSTGRES_HOST=/cloudsql/aione-zone1:asia-southeast1:iconic-knowledge-pg`
- `POSTGRES_DB=iconic_knowledge`
- `POSTGRES_USER=iconic_app`
- `GCS_UPLOAD_BUCKET=aione-zone1-iconic-demo-50194055876`
- `GOOGLE_CLOUD_PROJECT=aione-zone1`
- `OPENROUTER_CHAT_MODEL` และ optional vision/embedding model
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

## IAM ขั้นต่ำของ runtime service account

- `roles/cloudsql.client`
- `roles/storage.objectAdmin` เฉพาะ upload bucket
- `roles/secretmanager.secretAccessor` เฉพาะ secrets ที่ inject

Cloud Build service account ต้องอ่าน source/build image ได้ แต่ไม่ควรมีสิทธิ์อ่าน application secrets

## Deploy

ใช้คำสั่งจาก repository root และระบุ project/region ทุกครั้ง:

```powershell
gcloud run deploy iconic-knowledge-assistant `
  --source . `
  --project aione-zone1 `
  --region asia-southeast1 `
  --add-cloudsql-instances aione-zone1:asia-southeast1:iconic-knowledge-pg
```

จากนั้นตั้ง env/secrets ผ่าน `gcloud run services update` หรือ Google Cloud Console โดยไม่วาง secret จริงใน command history เมื่อ deploy เสร็จตรวจ `/api/health`, หน้า sign in, chat, Tavily query และ upload CSV หนึ่งไฟล์

## ยังไม่ทำในเดโม

Regional HA, private VPC redesign, production RBAC, DLP/malware scan, full OCR, alerting dashboard, load test และ restore drill อยู่ใน `docs/PRODUCTION_DEFERRED.md`
