import "server-only";

import { z } from "zod";

const tavilyResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string().catch("ไม่ระบุชื่อหน้า"),
    url: z.string().url(),
    content: z.string().catch(""),
    score: z.number().optional(),
    published_date: z.string().nullish(),
  })).default([]),
});

export type WebSearchResult = {
  title: string;
  url: string;
  excerpt: string;
  score: number | null;
  publishedDate: string | null;
};

export function getTavilyApiKey() {
  // Keep the mixed-case alias temporarily because the original demo env used it.
  return process.env.TAVILY_API_KEY?.trim() || process.env.Tavily_api_key?.trim() || "";
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const normalizedQuery = query.normalize("NFKC").trim().slice(0, 400);
  if (normalizedQuery.length < 2) throw new Error("คำค้นสั้นเกินไป");

  const apiKey = getTavilyApiKey();
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า TAVILY_API_KEY");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: normalizedQuery,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ค้นเว็บไม่สำเร็จ (${response.status})`);
  }

  const parsed = tavilyResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("ผลค้นเว็บมีรูปแบบไม่ถูกต้อง");

  return parsed.data.results.map((result) => ({
    title: result.title.trim() || "ไม่ระบุชื่อหน้า",
    url: result.url,
    excerpt: result.content.trim().slice(0, 1_600),
    score: result.score ?? null,
    publishedDate: result.published_date ?? null,
  }));
}
