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

  it.each([
    [400, "request data was invalid"],
    [401, "Authentication is required"],
    [403, "not authorized"],
    [404, "API endpoint was not found"],
    [409, "conflicts"],
    [429, "Too many requests"],
    [500, "temporarily unavailable"],
  ])("explains HTTP %i responses", async (status, detail) => {
    const fetcher = vi.fn(async () => new Response("not-json", { status }));
    await expect(new ApiClient("https://example.test", fetcher).createSession()).rejects.toThrow(detail);
  });

  it("distinguishes network failures", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("socket unavailable");
    });
    await expect(new ApiClient("https://example.test", fetcher).createSession()).rejects.toThrow("Unable to reach Asiyst API");
  });

  it("rejects an HTML or otherwise invalid health response", async () => {
    const fetcher = vi.fn(async () => new Response("<html>parked</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }));
    await expect(new ApiClient("https://example.test", fetcher).health()).rejects.toThrow("invalid JSON");
  });
});
