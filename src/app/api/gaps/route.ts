import { storage } from "@/db/storage";

export async function GET() {
  const gaps = await storage.listGaps();
  return Response.json({ gaps });
}
