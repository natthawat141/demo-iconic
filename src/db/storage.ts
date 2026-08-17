import "server-only";

import { mysqlStorage } from "./mysql-storage";
import { postgresStorage } from "./postgres-storage";
import { sqliteStorage } from "./sqlite-storage";

export const storage = process.env.POSTGRES_URL?.trim()
  ? postgresStorage
  : process.env.MYSQL_URL?.trim()
    ? mysqlStorage
    : sqliteStorage;

export function databaseLabel() {
  if (storage.provider === "postgres") return "GCP Cloud SQL · PostgreSQL";
  if (storage.provider === "mysql") return "Oracle MySQL · Remote";
  return "SQLite · Local demo";
}
