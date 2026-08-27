import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client.js";
describe("API client", () => {
  it("creates a temporary session", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ sessionId: "s", connectUrl: "https://asiyst.com/connect/cli/s", expiresAt: new Date(Date.now() + 1000).toISOString() }), { status: 200 }));
    await expect(new ApiClient("https://example.test", fetcher).createSession()).resolves.toMatchObject({ sessionId: "s" });
    expect(fetcher).toHaveBeenCalledWith("https://example.test/api/cli/sessions", expect.objectContaining({ method: "POST" }));
  });
  it("surfaces API errors", async () => {
    const fetcher = vi.fn(async () => new Response("no", { status: 503 }));
    await expect(new ApiClient("https://example.test", fetcher).createSession()).rejects.toBeInstanceOf(ApiError);
  });
});
