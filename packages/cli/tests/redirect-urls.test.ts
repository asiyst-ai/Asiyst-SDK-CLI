import { describe, expect, it, vi } from "vitest";
import {
  ASIYST_PRODUCTION_ORIGIN,
  buildAsiystUrl,
  buildProjectNewUrl,
  buildDomainVerificationUrl,
  buildApiKeysUrl,
  buildSdkInstallUrl,
  buildSdkDashboardUrl,
  buildAvatarStudioUrl,
  buildKnowledgeUrl,
  sanitizeUrlForLogging,
  toRelativeHandoffPath,
} from "../src/browser/urls.js";
import { isAllowedDestination } from "../src/api/onboarding.js";
import { openAuthenticatedWebPage } from "../src/browser/onboarding.js";
import { ApiClient } from "../src/api/client.js";
import { ApiError } from "../src/api/errors.js";
import * as openModule from "../src/browser/open.js";
import { loadOnboardingSession } from "../src/config/credentials.js";

describe("Centralized URL Redirect System", () => {
  const TEST_PROJECT_ID = "65f01a2b3c4d5e6f7a8b9c0d";
  const TEST_AVATAR_ID = "ava_9x8y7z";

  it("strictly enforces production origin https://asiyst.com", () => {
    expect(ASIYST_PRODUCTION_ORIGIN).toBe("https://asiyst.com");

    const projectNewUrl = new URL(buildProjectNewUrl());
    expect(projectNewUrl.origin).toBe("https://asiyst.com");
    expect(projectNewUrl.pathname).toBe("/dashboard/projects");

    const domainUrl = new URL(buildDomainVerificationUrl(TEST_PROJECT_ID));
    expect(domainUrl.origin).toBe("https://asiyst.com");
    expect(domainUrl.pathname).toBe("/dashboard/connect/verify");

    const apiKeysUrl = new URL(buildApiKeysUrl());
    expect(apiKeysUrl.origin).toBe("https://asiyst.com");
    expect(apiKeysUrl.pathname).toBe("/dashboard/api/keys");

    const sdkUrl = new URL(buildSdkInstallUrl(TEST_PROJECT_ID));
    expect(sdkUrl.origin).toBe("https://asiyst.com");
    expect(sdkUrl.pathname).toBe(`/dashboard/projects/${TEST_PROJECT_ID}/install`);

    const sdkDashboardUrl = new URL(buildSdkDashboardUrl());
    expect(sdkDashboardUrl.origin).toBe("https://asiyst.com");
    expect(sdkDashboardUrl.pathname).toBe("/dashboard/sdk");

    const avatarUrl = new URL(buildAvatarStudioUrl(TEST_PROJECT_ID));
    expect(avatarUrl.origin).toBe("https://asiyst.com");
    expect(avatarUrl.pathname).toBe("/dashboard/avatar-studio");

    const knowledgeUrl = new URL(buildKnowledgeUrl(TEST_PROJECT_ID, TEST_AVATAR_ID));
    expect(knowledgeUrl.origin).toBe("https://asiyst.com");
    expect(knowledgeUrl.pathname).toBe("/dashboard/knowledge");
  });

  it("never generates localhost, 127.0.0.1, or invalid protocols in production URLs", () => {
    const localhostUrl = buildAsiystUrl("http://localhost:3000/dashboard/connect-site", {
      projectId: TEST_PROJECT_ID,
    });
    expect(localhostUrl.origin).toBe("https://asiyst.com");
    expect(localhostUrl.hostname).toBe("asiyst.com");
    expect(localhostUrl.protocol).toBe("https:");
    expect(localhostUrl.port).toBe("");
  });

  it("correctly encodes query parameters and handles special characters", () => {
    const specialProjectId = "65f01a+2b/3c=4d";
    const url = new URL(buildDomainVerificationUrl(specialProjectId));
    expect(url.pathname).toBe("/dashboard/connect/verify");
  });

  it("sanitizes sensitive tokens from log messages", () => {
    const sensitiveUrl = "https://asiyst.com/cli/onboarding/handoff?token=super_secret_token_123&projectId=65f01a2b3c4d5e6f7a8b9c0d&apiKey=asiyst_sk_live_1234567890123456";
    const logged = sanitizeUrlForLogging(sensitiveUrl);
    expect(logged).not.toContain("super_secret_token_123");
    expect(logged).not.toContain("asiyst_sk_live_1234567890123456");
    // Sanitizer replaces sensitive values with bare REDACTED (no brackets to avoid %-encoding)
    expect(logged).toContain("REDACTED");
    expect(logged).toContain("65f01a2b3c4d5e6f7a8b9c0d");
  });

  it("validates allowed destinations in the handoff system", () => {
    expect(isAllowedDestination("/dashboard")).toBe(true);
    expect(isAllowedDestination("/dashboard/projects")).toBe(true);
    expect(isAllowedDestination("/dashboard/connect/verify")).toBe(true);
    expect(isAllowedDestination("/dashboard/sdk")).toBe(true);
    expect(isAllowedDestination(`/dashboard/projects/${TEST_PROJECT_ID}/install`)).toBe(true);
    expect(isAllowedDestination("/dashboard/connect-site")).toBe(true);
    expect(isAllowedDestination("/dashboard/connect-site?projectId=123")).toBe(true);
    expect(isAllowedDestination("/dashboard/domain-verification")).toBe(true);
    expect(isAllowedDestination("/dashboard/avatar-studio")).toBe(true);
    expect(isAllowedDestination("/dashboard/knowledge")).toBe(true);
    expect(isAllowedDestination("/dashboard/api-keys")).toBe(true);
    expect(isAllowedDestination("/dashboard/api/keys")).toBe(true);
    expect(isAllowedDestination("/dashboard/sdk")).toBe(true);
    expect(isAllowedDestination("/dashboard/projects/65f01a2b3c4d5e6f7a8b9c0d/connect-site")).toBe(true);

    expect(isAllowedDestination("https://evil.com")).toBe(false);
    expect(isAllowedDestination("//evil.com")).toBe(false);
    expect(isAllowedDestination("/unauthorized-endpoint")).toBe(false);
  });

  it("extracts relative handoff path with query parameters", () => {
    const fullUrl = `https://asiyst.com/dashboard/connect-site?projectId=${TEST_PROJECT_ID}`;
    const relative = toRelativeHandoffPath(fullUrl);
    expect(relative).toBe(`/dashboard/connect-site?projectId=${TEST_PROJECT_ID}`);
  });

  it("hands the verified project directly to the project-scoped domain verification route", async () => {
    const requests: { url: string; headers: Headers; body?: unknown }[] = [];
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({
          sessionId: "onboarding-session",
          userId: "A7kP2m-Q9xL4nT8X",
        }), { status: 201 });
      }
      return new Response(JSON.stringify({ handoffToken: "handoff-token" }), { status: 200 });
    });
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);
    const session = { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" };

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildDomainVerificationUrl(TEST_PROJECT_ID),
        session,
        "Domain Verification",
      ),
    ).resolves.toBe(true);

    const onboarding = requests.find((request) => request.url.endsWith("/cli/onboarding/session"));
    expect(onboarding?.headers.get("X-Asiyst-Session")).toBe("cli-session");
    expect(onboarding?.headers.get("Authorization")).toBe("Bearer cli-session");
    expect(onboarding?.body).toEqual({});

    const handoff = requests.find((request) => request.url.endsWith("/cli/onboarding/handoff"));
    expect(handoff?.body).toEqual({
      path: "/dashboard/connect/verify",
    });
    expect(handoff?.headers.get("X-Asiyst-Session")).toBe("onboarding-session");
    expect(handoff?.headers.get("Authorization")).toBe("Bearer onboarding-session");
    expect(openSpy).toHaveBeenCalledWith(
      "https://asiyst.com/cli/onboarding/handoff?token=handoff-token",
    );
  });

  it("uses the project-independent API keys destination", async () => {
    const requests: { url: string; body?: unknown }[] = [];
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      requests.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({ handoffToken: "api-key-token" }), { status: 200 });
    });
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildApiKeysUrl(),
        { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" },
        "API Keys",
      ),
    ).resolves.toBe(true);

    const handoff = requests.find((request) => request.url.endsWith("/cli/onboarding/handoff"));
    expect(handoff?.body).toEqual({ path: "/dashboard/api/keys" });
    expect(openSpy).toHaveBeenCalledWith("https://asiyst.com/cli/onboarding/handoff?token=api-key-token");
    expect(openSpy.mock.calls[0][0]).not.toContain("project");
  });

  it("rejects expired session when opening authenticated page", async () => {
    const expiredSession = {
      sessionId: "sess_expired",
      userId: "usr_123456",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    };
    const api = new ApiClient();

    await expect(
      openAuthenticatedWebPage(api, "/dashboard/connect-site", expiredSession, "Domain Verification"),
    ).rejects.toThrow(/expired/i);
  });

  it("preserves the persisted CLI session when the handoff API rejects authorization", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "unauthorized" }), { status: 401 });
    });
    const session = {
      sessionId: "cli-session",
      userId: "A7kP2m-Q9xL4nT8X",
    };

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        session,
        "Project Setup",
      ),
    ).rejects.toMatchObject({ status: 401, code: "HANDOFF_FAILED" });
    await expect(loadOnboardingSession()).resolves.toMatchObject({ sessionId: "cli_session_valid_12345" });
  });

  it("keeps a valid CLI session when browser opening fails", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({ handoffToken: "handoff-token" }), { status: 200 });
    });
    vi.spyOn(openModule, "openBrowser").mockResolvedValue(false);
    const session = { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" };

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        session,
        "Project Setup",
      ),
    ).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never opens a protected dashboard URL directly when handoff is unavailable", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    });
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" },
        "Project Setup",
      ),
    ).rejects.toMatchObject({ status: 404, code: "HANDOFF_FAILED" });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("uses the canonical handoff URL returned by the API", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session", userId: "A7kP2m-Q9xL4nT8X" }), { status: 201 });
      }
      return new Response(JSON.stringify({
        url: "https://asiyst.com/cli/onboarding/handoff?token=returned-token",
      }), { status: 200 });
    });

    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" },
      ),
    ).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledWith("https://asiyst.com/cli/onboarding/handoff?token=returned-token");
  });

  it("accepts the canonical handoffUrl field and handoff_token query parameter", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ onboardingSessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({
        handoffUrl: "https://asiyst.com/cli/onboarding/handoff?handoff_token=one-time-token",
      }), { status: 200 });
    });
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" },
        "Project Setup",
      ),
    ).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "https://asiyst.com/cli/onboarding/handoff?handoff_token=one-time-token",
    );
  });

  it("preserves the server-returned browser authorization URL", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({
        authorizationUrl: "https://asiyst.com/login?challenge=challenge-1&browser_session_id=browser-1&state=state-1",
      }), { status: 200 });
    });
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" },
      ),
    ).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "https://asiyst.com/login?challenge=challenge-1&browser_session_id=browser-1&state=state-1",
    );
  });

  it("rejects a handoff URL on a non-canonical host", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session" }), { status: 201 });
      }
      return new Response(JSON.stringify({
        url: "https://www.asiyst.com/cli/onboarding/handoff?token=returned-token",
      }), { status: 200 });
    });

    await expect(
      openAuthenticatedWebPage(
        new ApiClient("https://example.test", fetcher),
        buildProjectNewUrl(),
        { sessionId: "cli-session", userId: "A7kP2m-Q9xL4nT8X" },
      ),
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});
