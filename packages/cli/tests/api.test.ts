import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client.js";
import { parseVerifyKeyResponse, verifyApiKey } from "../src/api/auth.js";
import { verifyApiKeyRelationship, verifySdk } from "../src/api/verification.js";
import { fetchDomainVerificationStatus, importAvatar, setupSdkConfiguration } from "../src/api/projects.js";
import { createOnboardingSession } from "../src/api/onboarding.js";
import { resolveApiBaseUrl } from "../src/config/api.js";
import { isValidApiKey, isValidProjectId, isValidPublicIdentifier, isValidUserId } from "../src/config/ids.js";
const TEST_API_KEY = "a".repeat(32);
const TEST_PROJECT_ID = "K8mP2xQ7_vL4N9cR5T1zB6Y3";

describe("API client", () => {
  it("reuses or provisions SDK configuration using the authenticated session", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toBe("https://example.test/cli/onboarding/sdk/setup");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer cli-session");
      expect(headers.get("X-Asiyst-Session")).toBe("cli-session");
      expect(JSON.parse(String(init?.body))).toEqual({ projectId: TEST_PROJECT_ID });
      return new Response(JSON.stringify({
        success: true,
        projectId: TEST_PROJECT_ID,
        sdk: { configured: true, key: "pk_sdk_public", created: false },
      }), { status: 200 });
    });
    await expect(setupSdkConfiguration(
      new ApiClient("https://example.test", fetcher),
      TEST_PROJECT_ID,
      "cli-session",
    )).resolves.toEqual({
      projectId: TEST_PROJECT_ID,
      publicKey: "pk_sdk_public",
      configured: true,
      created: false,
    });
  });

  it("rejects SDK setup responses without a usable project-bound key", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      projectId: TEST_PROJECT_ID,
      sdk: { configured: true },
    }), { status: 200 }));
    await expect(setupSdkConfiguration(
      new ApiClient("https://example.test", fetcher),
      TEST_PROJECT_ID,
      "cli-session",
    )).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("verifies SDK activity with the persisted CLI session and selected project", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toBe("https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api/cli/sdk/verify");
      expect(new Headers(init?.headers).get("X-Asiyst-Session")).toBe("cli-session");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer cli-session");
      expect(JSON.parse(String(init?.body))).toEqual({ projectId: TEST_PROJECT_ID });
      return new Response(JSON.stringify({
        success: true,
        verified: true,
        projectId: TEST_PROJECT_ID,
        verifiedAt: "2026-09-13T00:00:00Z",
      }), { status: 200 });
    });
    await expect(verifySdk(new ApiClient("https://example.test", fetcher), {
      projectId: TEST_PROJECT_ID,
      sessionId: "cli-session",
    })).resolves.toEqual({ projectId: TEST_PROJECT_ID, verifiedAt: "2026-09-13T00:00:00Z" });
  });

  it("preserves SDK_NOT_ACTIVE as a retryable SDK activity state", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: "SDK_NOT_ACTIVE",
      message: "SDK activity has not been detected yet.",
    }), { status: 400 }));
    await expect(verifySdk(new ApiClient("https://example.test", fetcher), {
      projectId: TEST_PROJECT_ID,
      sessionId: "cli-session",
    })).rejects.toMatchObject({
      code: "SDK_NOT_ACTIVE",
      message: "SDK activity has not been detected yet. (code: SDK_NOT_ACTIVE)",
    });
  });

  it("rejects SDK verification when the server returns another project", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      verified: true,
      projectId: "A8mP2xQ7_vL4N9cR5T1zB6Y4",
      verifiedAt: "2026-09-13T00:00:00Z",
    }), { status: 200 }));
    await expect(verifySdk(new ApiClient("https://example.test", fetcher), {
      projectId: TEST_PROJECT_ID,
      sessionId: "cli-session",
    })).rejects.toMatchObject({ code: "PROJECT_MISMATCH", status: 409 });
  });

  it("rejects a successful SDK response without the canonical proof fields", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      verified: true,
      projectId: TEST_PROJECT_ID,
    }), { status: 200 }));
    await expect(verifySdk(new ApiClient("https://example.test", fetcher), {
      projectId: TEST_PROJECT_ID,
      sessionId: "cli-session",
    })).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it.each([
    [400, "SDK verification request was rejected"],
    [401, "Your Asiyst CLI session has expired"],
    [403, "The SDK or project is not authorized"],
    [404, "selected project could not be found"],
    [409, "no recent SDK activity"],
    [503, "temporarily unavailable"],
  ])("maps SDK verification HTTP %i", async (status, message) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "failure" }), { status }));
    await expect(verifySdk(new ApiClient("https://example.test", fetcher), {
      projectId: TEST_PROJECT_ID,
      sessionId: "cli-session",
    })).rejects.toThrow(message);
  });

  it("maps SDK verification network failures without clearing session state", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(verifySdk(new ApiClient("https://example.test", fetcher), {
      projectId: TEST_PROJECT_ID,
      sessionId: "cli-session",
    })).rejects.toThrow("Unable to reach the Asiyst SDK verification service");
  });

  it("verifies an API key against the selected project using only the API key bearer", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toBe(`https://asiyst.com/api/v1/projects/${TEST_PROJECT_ID}/api-key/verify`);
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer " + TEST_API_KEY);
      expect(new Headers(init?.headers).has("X-Asiyst-Session")).toBe(false);
      expect(JSON.parse(String(init?.body))).toEqual({});
      return new Response(JSON.stringify({
        success: true,
        valid: true,
        projectId: TEST_PROJECT_ID,
        userId: "user123",
      }), { status: 200 });
    });

    await expect(verifyApiKeyRelationship(
      new ApiClient("https://example.test", fetcher),
      { projectId: TEST_PROJECT_ID, apiKey: TEST_API_KEY, sessionId: "cli-session", userId: "ignored" },
    )).resolves.toMatchObject({ projectId: TEST_PROJECT_ID, userId: "user123" });
  });

  it.each([
    [401, "INVALID_API_KEY", "Invalid, revoked, or expired Asiyst API key."],
    [403, "API_KEY_PROJECT_MISMATCH", "This API key does not belong to the selected project or you do not have access to this project."],
    [400, "INVALID_REQUEST", "The API key verification request is invalid."],
    [404, "PROJECT_NOT_FOUND", "The selected project could not be found."],
    [405, "INVALID_REQUEST", "API key verification is not available for this request."],
    [503, "INTERNAL_ERROR", "Unable to verify the Asiyst API key right now. Please try again."],
  ])("classifies API-key verification HTTP %i as %s with correct message", async (status, code, messageSnippet) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "failure" }), { status }));
    const promise = verifyApiKeyRelationship(
      new ApiClient("https://example.test", fetcher),
      { projectId: TEST_PROJECT_ID, apiKey: TEST_API_KEY },
    );
    await expect(promise).rejects.toMatchObject({ status, code });
    await expect(promise).rejects.toThrow(messageSnippet);
  });

  it("handles network failures during API-key verification with specific message", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const promise = verifyApiKeyRelationship(
      new ApiClient("https://example.test", fetcher),
      { projectId: TEST_PROJECT_ID, apiKey: TEST_API_KEY },
    );
    await expect(promise).rejects.toMatchObject({ code: "NETWORK" });
    await expect(promise).rejects.toThrow("Unable to reach Asiyst API for API-key verification.");
  });

  it("rejects returned projectId mismatch during API-key verification", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      valid: true,
      projectId: "OTHER_PROJECT_ID_12345678",
      userId: "user123",
    }), { status: 200 }));
    const promise = verifyApiKeyRelationship(
      new ApiClient("https://example.test", fetcher),
      { projectId: TEST_PROJECT_ID, apiKey: TEST_API_KEY },
    );
    await expect(promise).rejects.toMatchObject({ status: 403, code: "API_KEY_PROJECT_MISMATCH" });
    await expect(promise).rejects.toThrow("This API key does not belong to the selected project");
  });

  it("rejects malformed or non-success API-key verification responses", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: false,
      valid: false,
    }), { status: 200 }));
    const promise = verifyApiKeyRelationship(
      new ApiClient("https://example.test", fetcher),
      { projectId: TEST_PROJECT_ID, apiKey: TEST_API_KEY },
    );
    await expect(promise).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(promise).rejects.toThrow("Received an invalid response while verifying the Asiyst API key.");
  });

  it("validates project ID and API key format before sending network request", async () => {
    const fetcher = vi.fn();
    await expect(verifyApiKeyRelationship(
      new ApiClient("https://example.test", fetcher),
      { projectId: "invalid", apiKey: TEST_API_KEY },
    )).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("checks domain verification through the authenticated status endpoint", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).toBe("https://example.test/cli/onboarding/domain-verification/status?projectId=project123");
      expect(init?.method).toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer cli-session");
      expect(headers.get("X-Asiyst-Session")).toBe("cli-session");
      expect(init?.body).toBeUndefined();
      return new Response(JSON.stringify({
        success: true,
        verified: true,
        status: "verified",
        projectId: "project123",
        domain: "example.com",
        verifiedAt: "2026-09-12T00:00:00Z",
      }), { status: 200 });
    });

    await expect(fetchDomainVerificationStatus(
      new ApiClient("https://example.test", fetcher),
      "project123",
      "cli-session",
    )).resolves.toEqual({
      success: true,
      verified: true,
      status: "verified",
      projectId: "project123",
      domain: "example.com",
      verifiedAt: "2026-09-12T00:00:00Z",
    });
  });

  it("accepts a pending domain verification response", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      verified: false,
      status: "pending",
      projectId: "project123",
    }), { status: 200 }));
    await expect(fetchDomainVerificationStatus(
      new ApiClient("https://example.test", fetcher),
      "project123",
      "cli-session",
    )).resolves.toMatchObject({ success: true, verified: false });
  });

  it("preserves failed and expired verification details", async () => {
    const responses = [
      {
        success: true,
        verified: false,
        status: "failed",
        projectId: "project123",
        domain: "example.com",
        errorCode: "DOMAIN_VERIFICATION_FAILED",
        message: "The DNS record did not match.",
      },
      {
        success: true,
        verified: false,
        status: "expired",
        projectId: "project123",
        domain: "example.com",
        errorCode: "DOMAIN_VERIFICATION_EXPIRED",
        message: "The domain verification challenge expired.",
      },
    ];
    let index = 0;
    const fetcher = vi.fn(async () => new Response(JSON.stringify(responses[index++]), { status: 200 }));
    const api = new ApiClient("https://example.test", fetcher);

    await expect(fetchDomainVerificationStatus(api, "project123", "cli-session")).resolves.toMatchObject(responses[0]);
    await expect(fetchDomainVerificationStatus(api, "project123", "cli-session")).resolves.toMatchObject(responses[1]);
  });

  it.each([
    [401, "SESSION_EXPIRED"],
    [400, "INVALID_PROJECT_ID"],
    [403, "FORBIDDEN"],
    [404, "PROJECT_NOT_FOUND"],
    [405, "INVALID_REQUEST"],
    [503, "INTERNAL_ERROR"],
  ])("classifies domain verification status HTTP %i as %s", async (status, code) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "status failure" }), { status }));
    await expect(fetchDomainVerificationStatus(
      new ApiClient("https://example.test", fetcher),
      "project123",
      "cli-session",
    )).rejects.toMatchObject({ status, code });
  });

  it("does not make a request without a project ID", async () => {
    const fetcher = vi.fn();
    await expect(fetchDomainVerificationStatus(
      new ApiClient("https://example.test", fetcher),
      "",
      "cli-session",
    )).rejects.toMatchObject({ status: 400, code: "INVALID_PROJECT_ID" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates an onboarding session with the authenticated CLI session", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer cli-session");
      expect(headers.get("X-Asiyst-Session")).toBe("cli-session");
      expect(JSON.parse(String(init?.body))).toEqual({});
      return new Response(JSON.stringify({ sessionId: "onboarding-session", userId: "A7kP2m-Q9xL4nT8X" }), { status: 201 });
    });
    await expect(createOnboardingSession(
      new ApiClient("https://example.test", fetcher),
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
