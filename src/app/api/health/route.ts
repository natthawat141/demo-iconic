import { isPostgresConfigured } from "@/db/postgres-config";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "iconic-knowledge-assistant",
    database: isPostgresConfigured() ? "postgresql" : "sqlite",
    webSearch: Boolean(process.env.TAVILY_API_KEY?.trim() || process.env.Tavily_api_key?.trim()),
  });
}
