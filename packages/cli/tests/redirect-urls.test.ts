import { describe, expect, it, vi } from "vitest";
import {
  ASIYST_PRODUCTION_ORIGIN,
  buildAsiystUrl,
  buildProjectNewUrl,
  buildDomainVerificationUrl,
  buildApiKeysUrl,
  buildSdkInstallUrl,
  buildAvatarStudioUrl,
  buildKnowledgeUrl,
  sanitizeUrlForLogging,
  toRelativeHandoffPath,
} from "../src/browser/urls.js";
import { isAllowedDestination } from "../src/api/onboarding.js";
import { openAuthenticatedWebPage } from "../src/browser/onboarding.js";
import { ApiClient } from "../src/api/client.js";
import { ApiError } from "../src/api/errors.js";

describe("Centralized URL Redirect System", () => {
  const TEST_PROJECT_ID = "65f01a2b3c4d5e6f7a8b9c0d";
  const TEST_AVATAR_ID = "ava_9x8y7z";

  it("strictly enforces production origin https://asiyst.com", () => {
    expect(ASIYST_PRODUCTION_ORIGIN).toBe("https://asiyst.com");

    const projectNewUrl = new URL(buildProjectNewUrl());
    expect(projectNewUrl.origin).toBe("https://asiyst.com");
    expect(projectNewUrl.pathname).toBe("/project/new");

    const domainUrl = new URL(buildDomainVerificationUrl(TEST_PROJECT_ID));
    expect(domainUrl.origin).toBe("https://asiyst.com");
    expect(domainUrl.pathname).toBe("/dashboard/connect-site");
    expect(domainUrl.searchParams.get("projectId")).toBe(TEST_PROJECT_ID);

    const apiKeysUrl = new URL(buildApiKeysUrl(TEST_PROJECT_ID));
    expect(apiKeysUrl.origin).toBe("https://asiyst.com");
    expect(apiKeysUrl.pathname).toBe("/dashboard/api-keys");
    expect(apiKeysUrl.searchParams.get("projectId")).toBe(TEST_PROJECT_ID);

    const sdkUrl = new URL(buildSdkInstallUrl(TEST_PROJECT_ID));
    expect(sdkUrl.origin).toBe("https://asiyst.com");
    expect(sdkUrl.pathname).toBe("/dashboard/sdk-install");
    expect(sdkUrl.searchParams.get("projectId")).toBe(TEST_PROJECT_ID);

    const avatarUrl = new URL(buildAvatarStudioUrl(TEST_PROJECT_ID));
    expect(avatarUrl.origin).toBe("https://asiyst.com");
    expect(avatarUrl.pathname).toBe("/dashboard/avatar-studio");
    expect(avatarUrl.searchParams.get("projectId")).toBe(TEST_PROJECT_ID);

    const knowledgeUrl = new URL(buildKnowledgeUrl(TEST_PROJECT_ID, TEST_AVATAR_ID));
    expect(knowledgeUrl.origin).toBe("https://asiyst.com");
    expect(knowledgeUrl.pathname).toBe("/dashboard/knowledge");
    expect(knowledgeUrl.searchParams.get("projectId")).toBe(TEST_PROJECT_ID);
    expect(knowledgeUrl.searchParams.get("avatarId")).toBe(TEST_AVATAR_ID);
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
    expect(url.searchParams.get("projectId")).toBe(specialProjectId);
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
    expect(isAllowedDestination("/project/new")).toBe(true);
    expect(isAllowedDestination("/dashboard/connect-site")).toBe(true);
    expect(isAllowedDestination("/dashboard/connect-site?projectId=123")).toBe(true);
    expect(isAllowedDestination("/dashboard/domain-verification")).toBe(true);
    expect(isAllowedDestination("/dashboard/avatar-studio")).toBe(true);
    expect(isAllowedDestination("/dashboard/knowledge")).toBe(true);
    expect(isAllowedDestination("/dashboard/api-keys")).toBe(true);
    expect(isAllowedDestination("/dashboard/sdk-install")).toBe(true);
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
});
