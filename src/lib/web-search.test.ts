import { afterEach, describe, expect, it, vi } from "vitest";

import { searchWeb } from "@/lib/web-search";

describe("Tavily web search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TAVILY_API_KEY;
    delete process.env.Tavily_api_key;
  });

  it("sends a bounded basic search without exposing raw content", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{
        title: "Next.js release",
        url: "https://nextjs.org/blog/example",
        content: "Official release summary",
        score: 0.94,
        published_date: "2026-08-16",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWeb("  Next.js ล่าสุด  ");

    expect(results).toEqual([expect.objectContaining({ title: "Next.js release", score: 0.94 })]);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(request.body))).toMatchObject({
      query: "Next.js ล่าสุด",
      search_depth: "basic",
      max_results: 5,
      include_raw_content: false,
    });
  });

  it("fails naturally when Tavily is not configured", async () => {
    await expect(searchWeb("ข่าวล่าสุด")).rejects.toThrow("TAVILY_API_KEY");
  });
});
