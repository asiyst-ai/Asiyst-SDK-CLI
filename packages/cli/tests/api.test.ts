import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client.js";
import { parseVerifyKeyResponse, verifyApiKey } from "../src/api/auth.js";
import { resolveApiBaseUrl } from "../src/config/api.js";

describe("API client", () => {
  it("verifies an API key with bearer auth", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const auth = headers.get("Authorization");
      expect(typeof auth === "string" && auth.length > 0).toBe(true);
      expect(headers.get("X-Asiyst-API-Key")).toBe("YOUR_API_KEY");
      expect(String(_url)).toBe("https://example.test/auth/api-key/verify");
      return new Response(JSON.stringify({
        valid: true,
        project: { id: "proj_1", name: "Store", website: "https://shop.example" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    await expect(verifyApiKey(new ApiClient("https://example.test", fetcher), "YOUR_API_KEY")).resolves.toMatchObject({
      projectId: "proj_1",
      projectName: "Store",
      website: "https://shop.example",
    });
  });

  it("maps HTTP 401 to an invalid key without exposing the server body", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "nope", code: "INVALID_API_KEY" }), { status: 401 }));
    await expect(verifyApiKey(new ApiClient("https://example.test", fetcher), "YOUR_API_KEY")).rejects.toMatchObject({
      code: "INVALID_API_KEY",
      status: 401,
    });
  });

  it("maps revoked keys from a stable error code", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: "API_KEY_REVOKED" }), { status: 401 }));
    await expect(verifyApiKey(new ApiClient("https://example.test", fetcher), "YOUR_API_KEY")).rejects.toMatchObject({
      code: "API_KEY_REVOKED",
    });
  });

  it.each([
    [400, "INVALID_REQUEST"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL_ERROR"],
    [503, "INTERNAL_ERROR"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const fetcher = vi.fn(async () => new Response("not-json", { status }));
    await expect(new ApiClient("https://example.test", fetcher).request("/auth/api-key/verify", { method: "POST" })).rejects.toMatchObject({ code, status });
  });

  it("distinguishes network failures without leaking fetch internals", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    await expect(new ApiClient("https://example.test", fetcher).request("/auth/api-key/verify")).rejects.toBeInstanceOf(ApiError);
    await expect(new ApiClient("https://example.test", fetcher).request("/auth/api-key/verify")).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("rejects a malformed success body", () => {
    expect(() => parseVerifyKeyResponse({ valid: true }, "YOUR_API_KEY")).toThrow("unexpected response");
  });
});

describe("API base URL", () => {
  it("uses the production API by default", () => {
    expect(resolveApiBaseUrl({})).toBe("https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api");
  });

  it("does not accept localhost even when an override is set", () => {
    expect(resolveApiBaseUrl({
      ASIIYST_API_MODE: "development",
      ASIIYST_API_URL: "http://localhost:3000/v1",
    })).toBe("https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api");
  });

  it("allows an explicit non-local development URL", () => {
    expect(resolveApiBaseUrl({
      ASIIYST_API_MODE: "development",
      ASIIYST_API_URL: "https://staging.example.com/v1",
    })).toBe("https://staging.example.com/v1");
  });
});
