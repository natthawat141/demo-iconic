# ICONIC Knowledge Assistant — Implementation Plan

> สถานะ: Approved implementation scope
> เป้าหมาย: สร้างเดโมที่ลูกค้าเห็นคุณค่าของผู้ช่วยความรู้, การจัดการ Knowledge และ Admin Workspace ได้จริง โดยตัดงาน Production-only ที่ยังมองไม่เห็นออกไปก่อน

## 1. Product statement

น้องฟ้าเป็นผู้ช่วยความรู้สำหรับทีม ICONIC ที่ทำงานสองด้านพร้อมกัน:

1. Member ใช้แชตเพื่อถามความรู้ทั่วไปหรือความรู้ของทีม, แนบรูป/เอกสาร และได้รับคำตอบที่เหมาะกับบริบท
2. Admin เห็นว่าใครคุยอะไร, ดูไฟล์/คำตอบ/Source, จัดการ Knowledge และใช้ AI ช่วยสรุปหรือสร้าง Draft โดยมนุษย์ยังเป็นผู้อนุมัติ

เรื่องที่เดโมต้องพิสูจน์คือ:

```text
User asks
  ├─ General question → AI answers naturally
  ├─ ICONIC question → Approved Knowledge retrieval → answer + sources
  ├─ Ambiguous question → AI asks one concise clarification
  ├─ Insufficient internal knowledge → no-answer → escalation / Knowledge Gap
  └─ File, image or Excel → extract / analyze → visual answer or chart

Admin reviews the history, files and gaps
  → prepares a Knowledge Draft
  → approves it
  → future answer can use it
```

## 2. Scope boundary

### In this demo

- Web-based member chat and admin workspace
- OpenRouter as the LLM provider, with models read from environment variables
- Cloud SQL PostgreSQL as the system of record, including pgvector
- Google Cloud Storage for user-visible uploaded files
- Knowledge lifecycle: Draft, Approved, Archived
- Conversation persistence by user and conversation ID
- AI-assisted admin workflows that always require human confirmation before data changes
- Excel and CSV analysis with rendered, inspectable charts in the chat/admin experience

### Explicitly deferred to production

- Cloud Logging dashboards, Monitoring alerts and distributed tracing
- High availability, regional failover and private-network redesign
- Enterprise SSO, production RBAC, compliance audit log and retention policy
- Malware scanning, DLP, production-grade document classification and full OCR pipeline
- Autoscaling/load testing, backup restore drills and cost alerting
- Google Drive sync, LINE, full CRM, policy management and recommendation engine

Deferred work is documented in `docs/PRODUCTION_DEFERRED.md` before handoff; it is not silently dropped.

## 3. Member experience

### 3.1 Visual direction

The Member screen follows the provided ChatGPT reference without copying its branding:

- Dark/light neutral surface, blue as the only product accent
- Empty state has one short greeting and one centered composer
- No giant hero, agent-online label, technical status cards, decorative dashboard blocks or rectangular shortcut cards
- Minimal left rail/sidebar for new chat, recent chats and account actions
- Composer contains attachment action, actual configured model label, optional voice control if supported, and send action
- A conversation moves the composer to the bottom and keeps message reading width comfortable
- No emoji mascot, robot artwork or playful visual language

### 3.2 Member routes

| Route | Visible purpose |
| --- | --- |
| `/` | Primary chat, new conversation and recent conversations |
| `/login` | Demo user selection / session entry |
| `/conversation/[id]` | Optional direct link to a saved conversation |

### 3.3 Attachment experience

- `+` opens an image/document/Excel picker
- Composer previews pending attachments and lets the user remove them before sending
- Images: JPEG, PNG, WebP, GIF; maximum file count and size are visible in the error state
- Documents/Excel show filename, type and processing state
- Sent messages keep a small preview or file card so the conversation remains understandable
- Files are uploaded to Cloud Storage; the browser never receives a permanent public bucket URL

## 4. Conversation harness

### 4.1 Intent router

Before answering, a small structured router uses the current message plus recent conversation context and returns one of:

```text
general_knowledge
company_knowledge
ambiguous
vision
file_analysis
knowledge_overview
```

The router is not exposed to the user. It prevents the current failure mode where a plain question such as “API คืออะไร” becomes a failed Knowledge search.

### 4.2 Behaviour contract

| Intent | Behaviour | Example |
| --- | --- | --- |
| General | Answer from the base model normally; do not retrieve team Knowledge | “API คืออะไร?” |
| Company | Force Approved Knowledge search, then answer only from retrieved facts and show Sources | “ขั้นตอนติดตามลูกค้าของทีมคืออะไร?” |
| Ambiguous | Ask one human, concise clarification rather than guessing/searching broadly | “แล้ว API ล่ะ?” |
| Vision | Read visible image content. Retrieve only when asked to relate it to ICONIC policy/work | “ช่วยดูภาพนี้ให้หน่อย” |
| File analysis | Extract allowed file data, calculate a compact analysis and render an appropriate chart | “สรุปยอดขายจาก Excel นี้” |
| Overview | Retrieve aggregate Knowledge information and render a chart | “Knowledge ของทีมมีหมวดอะไรบ้าง?” |

### 4.3 Safety and naturalness

- Greetings, identity questions, thanks and normal conversation do not call retrieval
- General explanations are allowed; the assistant does not pretend that general knowledge came from ICONIC
- Internal process, policy, client or team facts require Approved Knowledge
- If internal Knowledge is insufficient, say so naturally, optionally mention related topic titles, and offer escalation
- Never invent internal policies, named people, channels or customer-specific product recommendations
- Never mention tool names, vectors, scores or internal routing to the user
- Use Thai naturally and retain the conversational context of the thread
- Provider failure returns a helpful retry state instead of a technical error

### 4.4 Models

- `OPENROUTER_CHAT_MODEL` is shown honestly in the UI and is the default conversational model
- `OPENROUTER_VISION_MODEL` is optional and used for image/file analysis when configured
- A model must be verified to support its requested modality before the relevant UI path is enabled
- The demo does not claim an unsupported model capability

## 5. Identity, conversations and visible product history

The demo introduces stable identity without pretending to be enterprise authentication.

### 5.1 Demo session

- Login/entry creates a signed demo session cookie
- User ID is server-owned; the browser cannot select another user's ID by passing a request field
- Seed users make the demo legible, for example member and admin personas
- Admin routes require the admin session role

### 5.2 Database records

```text
users
  id, display_name, role, created_at, last_active_at

conversations
  id, user_id, title, created_at, updated_at

messages
  id, conversation_id, role, content, model_id,
  answer_kind, created_at

answer_sources
  id, message_id, knowledge_item_id, relevance_score

answer_feedback
  id, message_id, user_id, rating, comment, created_at

uploaded_files
  id, user_id, conversation_id, knowledge_item_id,
  original_name, content_type, byte_size, storage_key,
  processing_state, extracted_summary, created_at
```

Conversation history is a visible product feature: Member sees their own history and Admin can inspect the team view. It is not an infrastructure monitoring project.

## 6. Knowledge and pgvector

### 6.1 Knowledge lifecycle

- Admin can create, edit and classify Knowledge
- Fields: title, summary, content, category, tags, source, owner, review date and status
- Draft and Archived entries never enter the retrieval set
- Approving or changing a Knowledge item rebuilds the relevant embeddings
- Source cards link back to the visible Knowledge item

### 6.2 Retrieval implementation

- PostgreSQL is the only remote system of record
- `pgvector` stores embeddings for approved Knowledge chunks
- Retrieval uses semantic similarity plus Thai-friendly lexical signals
- A fixed embedding model/dimension is chosen before creating an HNSW index for the active production-like retrieval path
- The demo falls back gracefully if the provider embedding call fails; it does not leak the failure as a fabricated answer

## 7. File, document and spreadsheet analysis

### 7.1 Storage model

- Check for an appropriate existing bucket in `aione-zone1` first
- Reuse it if its ownership/lifecycle is appropriate; otherwise create one scoped to the demo
- Cloud Storage stores bytes; Cloud SQL stores metadata, ownership and processing results
- Object paths are namespaced by user and conversation ID
- The app reads files through server-side credentials or short-lived signed URLs only

### 7.2 Supported visible behaviours

| File kind | Demo behaviour |
| --- | --- |
| Image | Vision description, optional relation to Knowledge, image preview |
| CSV | Detect headers/types, summarise rows/columns, propose metrics/chart |
| XLSX/XLS | Read sheets and tables, show selected sheet summary, calculate descriptive statistics and chart appropriate fields |
| PDF/DOCX | Store and show a file card; extract text only for supported formats and present a reviewable summary |

No hidden autonomous ingestion is approved. The user or Admin chooses the file, sees its processing status and can use the result in a conversation or Knowledge Draft.

### 7.3 Excel chart flow

```text
User attaches Excel
  → file saved to GCS
  → server inspects workbook/sheets
  → AI proposes a compact analysis plan
  → app calculates summary data deterministically
  → chart component renders in the conversation
  → user can ask a follow-up or Admin can save a summary as a draft
```

The system will choose the smallest sensible chart:

- category comparison → bar chart
- date trend → line chart
- composition → bar/donut only when few categories
- no chart when a clear summary table is more honest

The analysis response includes the selected sheet, fields, row count and simple caveats; it does not imply that the AI verified business meaning the spreadsheet does not contain.

## 8. Admin workspace

The current visual direction of existing Admin screens is retained. New work adds task-focused views instead of redesigning the workspace.

### 8.1 Admin routes

| Route | Purpose |
| --- | --- |
| `/admin` | Existing high-level workspace summary |
| `/admin/users` | User list, latest activity, conversation count and open gaps |
| `/admin/conversations` | Filterable conversation list by user/date/outcome |
| `/admin/conversations/[id]` | Readable transcript with sources, files, feedback and escalation |
| `/admin/files` | Uploaded image/document/file list with owner and linked context |
| `/admin/ai` | Admin AI workspace |
| `/knowledge/*` | Existing Knowledge Library and editor |
| `/gaps` | Existing unanswered/escalation queue |

### 8.2 Admin AI workspace

Admin AI is a second, focused assistant—not a different product.

It can:

- summarise selected conversations or a user's recurring questions
- identify repeated Knowledge Gaps
- review an uploaded document/Excel analysis and propose a structured summary
- draft a Knowledge item from selected evidence
- suggest categories/tags/owner/review date
- explain what changed between Knowledge drafts

It cannot approve, publish, delete, change user data or send external messages without a visible Admin confirmation action.

## 9. Google Cloud usage

### Used for visible demo functionality

```text
Cloud SQL PostgreSQL + pgvector  → conversations, Knowledge, metadata
Cloud Storage                    → uploaded images/documents/Excel
Secret Manager                   → app credentials
Cloud Run                         → deployed demo URL when deployment begins
```

### Not enabled merely because it exists

Cloud Logging dashboards, alert policies, tracing, Pub/Sub, Cloud Tasks, GKE, Vertex AI and additional vector products remain deferred unless an implementation path demonstrably needs them. OpenRouter remains the model provider.

## 10. Delivery sequence

### Phase 0 — Plan and safe checkpoint

1. Commit this plan and a clear WIP checkpoint.
2. Inventory current changes so unrelated work is not overwritten.
3. Confirm existing GCP bucket resources read-only before creating anything.

### Phase 1 — Member chat and routing

1. Replace the current empty-state hero/cards with the minimal chat experience.
2. Finish attachment UI and error states.
3. Add intent routing and conversation-aware follow-ups.
4. Verify general, internal, ambiguous, no-answer and image turns.

### Phase 2 — Persistence and Admin visibility

1. Add user/session, conversations, messages, source references and feedback data.
2. Persist new chat turns to PostgreSQL.
3. Add Member history and Admin Users/Conversations/Transcript views.
4. Keep access scope visible and role-checked.

### Phase 3 — Files and analytical UI

1. Connect GCS uploads to conversation/file records.
2. Add file processing states and extraction summaries.
3. Implement CSV/XLSX analysis endpoint and chart renderer.
4. Add Admin file inventory and Admin AI actions.

### Phase 4 — Knowledge improvement loop

1. Connect visible feedback and gaps to Admin workflow.
2. Add Admin AI draft proposal from selected conversation/file/gap.
3. Require human review and Approved status before retrieval.
4. Enable/validate pgvector index for the selected embedding model.

### Phase 5 — Demo readiness

1. Connect local development to the existing Cloud SQL instance through the Auth Proxy without putting a password in Git.
2. Deploy to Cloud Run only after a local end-to-end pass.
3. Create demo reset data and a 10–12 minute demo script.
4. Run the acceptance scenarios below and freeze code.

## 11. Acceptance scenarios

1. **General:** “API คืออะไร?” receives a normal answer without a Knowledge Source card.
2. **Internal:** “ขั้นตอนติดตามลูกค้าของทีมคืออะไร?” retrieves Approved Knowledge and presents a Source.
3. **Ambiguous:** “แล้ว API ล่ะ?” asks whether the user means a general API or ICONIC system API when context does not resolve it.
4. **No-answer:** a question outside the Knowledge base does not fabricate an internal answer and creates/escalates a gap.
5. **Image:** image-only message is previewed, sent and answered by the vision-capable model.
6. **Excel:** a workbook attachment identifies its sheet/data, presents a readable summary and renders a truthful chart where applicable.
7. **Identity:** two demo users cannot see each other's Member history.
8. **Admin:** Admin sees users, conversation history, sources, files and feedback.
9. **Admin AI:** proposed Knowledge Draft is reviewable and cannot be auto-approved.
10. **Persistence:** the same Cloud SQL data appears after app restart.
11. **Demo:** a reset restores known demo data; a provider failure produces a usable fallback.

## 12. Definition of done

The demo is ready for review when every visible experience in this plan has a working, testable path; the remaining production-only tasks are listed explicitly; there are no secrets in the repository; and the app has an accessible demo URL.
