import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

declare global {
  var __iconicVitestDatabaseReady: boolean | undefined;
}

// Keep tests isolated from the SQLite database used by a running `next dev`.
// Without this, a demo interaction can race a test reset and make a green
// suite fail nondeterministically with duplicate seeded rows.
if (!globalThis.__iconicVitestDatabaseReady) {
  const databasePath = path.join(tmpdir(), `iconic-vitest-${process.pid}.sqlite`);
  for (const suffix of ["", "-wal", "-shm"]) {
    const candidate = `${databasePath}${suffix}`;
    if (existsSync(candidate)) rmSync(candidate, { force: true });
  }
  process.env.DEMO_DB_PATH = databasePath;
  globalThis.__iconicVitestDatabaseReady = true;
}
