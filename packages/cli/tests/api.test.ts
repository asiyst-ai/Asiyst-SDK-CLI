import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client.js";
import { parseVerifyKeyResponse, verifyApiKey } from "../src/api/auth.js";
import { importAvatar } from "../src/api/projects.js";
import { createOnboardingSession } from "../src/api/onboarding.js";
import { resolveApiBaseUrl } from "../src/config/api.js";
import { isValidApiKey, isValidProjectId, isValidPublicIdentifier, isValidUserId } from "../src/config/ids.js";
const TEST_API_KEY = "a".repeat(32);
const TEST_PROJECT_ID = "K8mP2xQ7_vL4N9cR5T1zB6Y3";

describe("API client", () => {
  it("creates an onboarding session with the authenticated CLI session", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer cli-session");
      expect(headers.get("X-Asiyst-Session")).toBe("cli-session");
      expect(JSON.parse(String(init?.body))).toEqual({ userId: "A7kP2m-Q9xL4nT8X" });
      return new Response(JSON.stringify({ sessionId: "onboarding-session", userId: "A7kP2m-Q9xL4nT8X" }), { status: 201 });
    });
    await expect(createOnboardingSession(
      new ApiClient("https://example.test", fetcher),
      "A7kP2m-Q9xL4nT8X",
      "cli-session",
    )).resolves.toMatchObject({ sessionId: "onboarding-session" });
  });

  it("verifies an API key with bearer auth", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const auth = headers.get("Authorization");
      expect(typeof auth === "string" && auth.length > 0).toBe(true);
      expect(headers.get("X-Asiyst-API-Key")).toBe(TEST_API_KEY);
      expect(String(_url)).toBe("https://example.test/verify/api-key");
      return new Response(JSON.stringify({
        valid: true,
        project: { id: TEST_PROJECT_ID, name: "Store", website: "https://shop.example" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    await expect(verifyApiKey(new ApiClient("https://example.test", fetcher), TEST_API_KEY)).resolves.toMatchObject({
      projectId: TEST_PROJECT_ID,
      projectName: "Store",
      website: "https://shop.example",
    });
  });

  it("maps HTTP 401 to an invalid key without exposing the server body", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "nope", code: "INVALID_API_KEY" }), { status: 401 }));
    await expect(verifyApiKey(new ApiClient("https://example.test", fetcher), TEST_API_KEY)).rejects.toMatchObject({
      code: "INVALID_API_KEY",
      status: 401,
    });
  });

  it("maps revoked keys from a stable error code", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: "API_KEY_REVOKED" }), { status: 401 }));
    await expect(verifyApiKey(new ApiClient("https://example.test", fetcher), TEST_API_KEY)).rejects.toMatchObject({
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
    expect(() => parseVerifyKeyResponse({ valid: true }, TEST_API_KEY)).toThrow("unexpected response");
  });

  it("rejects a verified response whose project does not match the requested project", () => {
    expect(() => parseVerifyKeyResponse({
      valid: true,
      userId: "A7kP2m-Q9xL4nT8X",
      project: { id: TEST_PROJECT_ID },
    }, TEST_API_KEY, {
      userId: "A7kP2m-Q9xL4nT8X",
      projectId: "A8mP2xQ7_vL4N9cR5T1zB6Y4",
    })).toThrowError(expect.objectContaining({ code: "PROJECT_MISMATCH" }));
  });

  it("rejects a verified response whose user does not match the requested user", () => {
    expect(() => parseVerifyKeyResponse({
      valid: true,
      userId: "B7kP2m-Q9xL4nT8X",
      project: { id: TEST_PROJECT_ID },
    }, TEST_API_KEY, {
      userId: "A7kP2m-Q9xL4nT8X",
      projectId: TEST_PROJECT_ID,
    })).toThrowError(expect.objectContaining({ code: "USER_MISMATCH" }));
  });

  it("accepts valid public identifiers and rejects obvious UUIDs and empty values", () => {
    expect(isValidPublicIdentifier("K8mP2xQ7_vL4N9cR5T1zB6Y3")).toBe(true);
    expect(isValidPublicIdentifier("67af7387-cb93-47c9-accc-a66381baf619")).toBe(false);
    expect(isValidPublicIdentifier("A7kP2m_Q9xL4nT8cV5rZ1wB3")).toBe(true);
    expect(isValidPublicIdentifier(" ")).toBe(false);
  });

  it("enforces the Connect Site identifier lengths before network requests", () => {
    expect(isValidProjectId(TEST_PROJECT_ID)).toBe(true);
    expect(isValidProjectId("proj_1")).toBe(false);
    expect(isValidApiKey(TEST_API_KEY)).toBe(true);
    expect(isValidApiKey(`as_${"a".repeat(32)}`)).toBe(true);
    expect(isValidApiKey(`as_${"a".repeat(64)}`)).toBe(true);
    expect(isValidApiKey("short")).toBe(false);
  });

  it("accepts generated Asiyst User IDs with hyphens", () => {
    const generatedIds = [
      "C-ibgiHj9B5SKLd9",
      "aB3-9xY7K2mN4pQ6",
      "Z9-abcDEF0123456",
    ];
    for (const userId of generatedIds) {
      expect(userId).toHaveLength(16);
      expect(isValidUserId(userId)).toBe(true);
    }
  });

  it.each(["", "undefined", "null", "short", "A".repeat(15), "A".repeat(17), "C ibgiHj9B5SKL", "C@ibgiHj9B5SKL", "C/ibgiHj9B5SKL", "C-ibgiHj9B5SKLd9OJE2BNCe"])(
    "rejects invalid User ID %j",
    (userId) => {
      expect(isValidUserId(userId)).toBe(false);
    },
  );
});

describe("API base URL", () => {
  it("uses the production API by default", () => {
    expect(resolveApiBaseUrl({})).toBe("https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api");
  });

  describe("avatar import", () => {
    it("uses the selected user, project, and avatar with header authentication", async () => {
      const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
        expect(String(url)).toBe("https://example.test/cli/projects/K8mP2xQ7_vL4N9cR5T1zB6Y3/avatars/import");
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")?.startsWith("Bearer ")).toBe(true);
        expect(headers.get("X-Asiyst-API-Key")).toBe(TEST_API_KEY);
        expect(headers.get("X-Asiyst-Session")).toBe("cli-session");
        expect(JSON.parse(String(init?.body))).toEqual({
          userId: "A7kP2m-Q9xL4nT8X",
          projectId: "K8mP2xQ7_vL4N9cR5T1zB6Y3",
          avatarId: "A7K9M2QX4P",
        });
        return new Response(JSON.stringify({ imported: true, avatarId: "A7K9M2QX4P" }), { status: 200 });
      });

      await expect(importAvatar(new ApiClient("https://example.test", fetcher), {
        userId: "A7kP2m-Q9xL4nT8X",
        projectId: "K8mP2xQ7_vL4N9cR5T1zB6Y3",
        apiKey: TEST_API_KEY,
        avatarId: "A7K9M2QX4P",
        sessionId: "cli-session",
      })).resolves.toMatchObject({ imported: true, avatarId: "A7K9M2QX4P" });
    });

    it("rejects an invalid avatar before making a request", async () => {
      const fetcher = vi.fn();
      await expect(importAvatar(new ApiClient("https://example.test", fetcher), {
        userId: "A7kP2m-Q9xL4nT8",
        projectId: "K8mP2xQ7_vL4N9cR5T1zB6Y3",
        apiKey: TEST_API_KEY,
        avatarId: "short",
      })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
      expect(fetcher).not.toHaveBeenCalled();
    });
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
