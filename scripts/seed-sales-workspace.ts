import { seedKnowledge } from "@/db/seed-data";
import { storage } from "@/db/storage";

const salesWorkspaceKnowledge = seedKnowledge.filter((item) => item.id.startsWith("km-sales-"));

async function main() {
  const existing = new Set((await storage.listKnowledge()).map((item) => item.id));
  const missing = salesWorkspaceKnowledge.filter((item) => !existing.has(item.id));

  for (const item of missing) {
    await storage.createKnowledge(item);
  }

  console.log(JSON.stringify({
    provider: storage.provider,
    totalSalesWorkspaceRecords: salesWorkspaceKnowledge.length,
    created: missing.length,
    alreadyPresent: salesWorkspaceKnowledge.length - missing.length,
  }));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
