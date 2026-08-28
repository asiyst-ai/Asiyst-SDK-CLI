import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client.js";
describe("API client", () => {
  it("creates a temporary session", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ sessionId: "s", connectUrl: "https://asiyst.com/connect/cli/s", expiresAt: new Date(Date.now() + 1000).toISOString() }), { status: 200 }));
    await expect(new ApiClient("https://example.test", fetcher).createSession()).resolves.toMatchObject({ sessionId: "s" });
    expect(fetcher).toHaveBeenCalledWith("https://example.test/cli/sessions", expect.objectContaining({ method: "POST" }));
  });
  it("surfaces API errors", async () => {
    const fetcher = vi.fn(async () => new Response("no", { status: 503 }));
    await expect(new ApiClient("https://example.test", fetcher).createSession()).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects an HTML or otherwise invalid health response", async () => {
    const fetcher = vi.fn(async () => new Response("<html>parked</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }));
    await expect(new ApiClient("https://example.test", fetcher).health()).rejects.toThrow("invalid JSON");
  });
});
