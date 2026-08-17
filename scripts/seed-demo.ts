import { storage } from "../src/db/storage";

async function main() {
  await storage.resetDemoData();
  console.log(
    `Demo knowledge, gaps, and retrieval index were reset (${storage.provider}).`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
