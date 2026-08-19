import "server-only";

import { postgresStorage } from "./postgres-storage";
import { isPostgresConfigured } from "./postgres-config";
import { sqliteStorage } from "./sqlite-storage";

// Storage provider resolution:
// 1. GCP Cloud SQL PostgreSQL (production system of record with pgvector)
// 2. Local SQLite (offline developer demo)
// Note: Legacy MySQL adapter (mysql-storage.ts) has been deprecated and removed from active runtime.
export const storage = isPostgresConfigured()
  ? postgresStorage
  : sqliteStorage;

export function databaseLabel() {
  if (storage.provider === "postgres") return "GCP Cloud SQL · PostgreSQL";
  return "SQLite · Local demo";
}

