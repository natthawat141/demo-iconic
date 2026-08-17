import "server-only";

import type { PoolConfig } from "pg";

export function isPostgresConfigured() {
  return Boolean(process.env.POSTGRES_URL?.trim()) || Boolean(
    process.env.POSTGRES_HOST?.trim() &&
    process.env.POSTGRES_DB?.trim() &&
    process.env.POSTGRES_USER?.trim(),
  );
}

export function postgresPoolConfig(overrides: PoolConfig = {}): PoolConfig {
  const connectionString = process.env.POSTGRES_URL?.trim();
  if (connectionString) return { connectionString, ...overrides };

  const host = process.env.POSTGRES_HOST?.trim();
  const database = process.env.POSTGRES_DB?.trim();
  const user = process.env.POSTGRES_USER?.trim();
  if (!host || !database || !user) {
    throw new Error("PostgreSQL is not configured");
  }

  const parsedPort = Number(process.env.POSTGRES_PORT || 5432);
  return {
    host,
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5432,
    database,
    user,
    password: process.env.POSTGRES_PASSWORD ?? "",
    ...overrides,
  };
}
