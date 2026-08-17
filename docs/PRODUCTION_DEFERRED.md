# Production-deferred work

This demo deliberately implements only work that a customer or project owner can see and evaluate. The following items are not production claims.

## Implemented for the demo

- Cloud SQL PostgreSQL (`iconic-knowledge-pg`) is the primary remote data store; pgvector is enabled for Knowledge retrieval.
- Google Cloud Storage bucket `aione-zone1-iconic-demo-50194055876` stores uploaded binary files. PostgreSQL stores metadata, ownership, conversation link and the tabular summary only.
- Member chat handles general questions, Tavily web search, ICONIC Knowledge questions, ambiguous questions, image/PDF input and CSV/XLSX analysis.
- Clerk sign in/sign up provides stable demo identities; conversations, files and usage are stored by Clerk user ID when signed in.
- Admin can see demo users, conversation transcripts, uploaded files and an advisory-only Admin AI workspace.

## Explicitly deferred to a production phase

- Production SSO, organization membership, RBAC and a hardened Admin authorization boundary. Clerk is connected for demo identity, while signed-out visitors still receive a browser-scoped fallback ID.
- Service account IAM design, Workload Identity and secret rotation. Local development may opt into a local gcloud-user credential; Cloud Run must use its service account and Application Default Credentials instead.
- Malware scanning, OCR/document extraction pipeline, sensitive-data/DLP controls, retention rules and legal/compliance review for uploads.
- Signed download URLs, document preview permissions, object lifecycle policies and disaster-recovery procedures for uploaded files.
- VPC/private-IP design review, regional HA, connection pooling sizing, restore drill and Cloud SQL Query Insights/alerts.
- Centralized logging dashboards, SLOs, incident response, audit exports, rate limiting, abuse protection and load testing.
- Production-scale automated evaluation corpus, red-team prompts, human quality-review workflow and source freshness SLA for the assistant.
- Accessibility audit, responsive-device test matrix, localization review and end-to-end/browser test suite.

## Rule for the next phase

Do not describe any deferred item as available in sales material or a customer demo. Add it only after a named owner, acceptance criteria, budget and verification evidence are agreed.
