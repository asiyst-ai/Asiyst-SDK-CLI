import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectCommand } from "../src/commands/connect.js";
import { logoutCommand } from "../src/commands/logout.js";
import { statusCommand } from "../src/commands/status.js";
import { clearConnection, clearOnboardingSession, loadConnection, loadOnboardingSession, saveConnection, saveOnboardingSession } from "../src/config/credentials.js";
import { ApiClient } from "../src/api/client.js";
import * as secretModule from "../src/ui/secret.js";
import * as selectorModule from "../src/ui/selector.js";
import * as openModule from "../src/browser/open.js";
import * as writerModule from "../src/integration/writer.js";

const TEST_PROJECT_ID = "K8mP2xQ7_vL4N9cR5T1zB6Y3";
const TEST_API_KEY = "a".repeat(32);
const TEST_AVATAR_ID = "A7K9M2QX4P";
const TEST_USER_ID = "A7kP2m-Q9xL4nT8X";
const TEST_SESSION_ID = "cli_session_valid_12345";
const TEST_PUBLIC_KEY = "P8mP2xQ7_vL4N9cR5T1zB6Y3";

describe("CLI connect flow", () => {
  beforeEach(async () => {
    await clearConnection(process.cwd());
    await clearOnboardingSession();
    vi.restoreAllMocks();
    vi.spyOn(writerModule, "applyIntegration").mockReturnValue({ writtenFiles: [], modifiedFiles: [] } as any);
    vi.spyOn(writerModule, "installSdk").mockResolvedValue();
  });

  it("CASE 1: No CLI session -> /connect asks user to run /login without opening browser", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await connectCommand(process.cwd());

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Session expired or not logged in");
    expect(logged).toContain("/login");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("CASE 2: Valid CLI session -> confirms account without User ID prompt", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    // Cancel at shouldConnect prompt to inspect initial output
    vi.spyOn(selectorModule, "selectOption").mockResolvedValueOnce({
      type: "selected" as const,
      value: false,
    });

    await connectCommand(process.cwd());

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain("Step 1 — Verify User");
    expect(logged).not.toContain("Paste your User ID");
    expect(logged).toContain("Connection cancelled.");
  });

  it("selects an existing project without opening project creation and keeps session auth headers", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const openedUrls: string[] = [];
    vi.spyOn(openModule, "openBrowser").mockImplementation(async (url) => {
      openedUrls.push(url);
      return true;
    });
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: "existing" });
    vi.spyOn(secretModule, "readInput").mockResolvedValueOnce(TEST_PROJECT_ID).mockResolvedValueOnce(undefined);

    const requests: { url: string; headers: Headers; body?: unknown }[] = [];
    const mockFetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const urlStr = String(url);
      requests.push({
        url: urlStr,
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (urlStr.endsWith("/verify/project")) {
        return new Response(JSON.stringify({
          valid: true,
          project: { id: TEST_PROJECT_ID, name: "Existing App", publicKey: TEST_PUBLIC_KEY },
        }), { status: 200 });
      }
      if (urlStr.endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session", userId: TEST_USER_ID }), { status: 201 });
      }
      if (urlStr.endsWith("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "domain-token" }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/domain-verification/status")) {
        return new Response(JSON.stringify({ success: true, verified: true, status: "verified", projectId: TEST_PROJECT_ID }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await connectCommand(process.cwd(), new ApiClient("https://example.test", mockFetcher));

    const projectVerification = requests.find((request) => request.url.endsWith("/verify/project"));
    expect(projectVerification?.headers.get("Authorization")).toBe("Bearer " + TEST_SESSION_ID);
    expect(projectVerification?.headers.get("X-Asiyst-Session")).toBe(TEST_SESSION_ID);
    const handoff = requests.find((request) =>
      (request.body as { path?: string } | undefined)?.path === "/dashboard/connect/verify");
    expect(handoff?.body).toEqual({ path: "/dashboard/connect/verify" });
    expect(openedUrls).toEqual([
      "https://asiyst.com/cli/onboarding/handoff?token=domain-token",
      "https://asiyst.com/cli/onboarding/handoff?token=domain-token",
    ]);
    expect(logSpy.mock.calls.map((call) => call.join(" ")).join("\n")).toContain("Connection cancelled.");
  });

  it("retries an invalid project returned by the API with a useful authorization error", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: "existing" })
      .mockResolvedValueOnce({ type: "selected" as const, value: true });
    vi.spyOn(secretModule, "readInput")
      .mockResolvedValueOnce("B".repeat(24))
      .mockResolvedValueOnce(TEST_PROJECT_ID)
      .mockResolvedValueOnce(undefined);

    let projectChecks = 0;
    const mockFetcher = vi.fn(async (url: URL | RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/verify/project")) {
        projectChecks += 1;
        if (projectChecks === 1) {
          return new Response(JSON.stringify({ message: "Forbidden", code: "FORBIDDEN" }), { status: 403 });
        }
        return new Response(JSON.stringify({
          valid: true,
          project: { id: TEST_PROJECT_ID, publicKey: TEST_PUBLIC_KEY },
        }), { status: 200 });
      }
      if (urlStr.endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session", userId: TEST_USER_ID }), { status: 201 });
      }
      if (urlStr.endsWith("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "domain-token" }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/domain-verification/status")) {
        return new Response(JSON.stringify({ success: true, verified: true, status: "verified", projectId: TEST_PROJECT_ID }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await connectCommand(process.cwd(), new ApiClient("https://example.test", mockFetcher));

    const logged = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(projectChecks).toBe(2);
    expect(logged).toContain("does not have access to that project");
    expect(logged).toContain("Connection cancelled.");
  });

  it("CASE 3: Valid CLI session -> full 8-step project-first connect flow completes successfully", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const openedUrls: string[] = [];
    vi.spyOn(openModule, "openBrowser").mockImplementation(async (url) => {
      openedUrls.push(url);
      return true;
    });
    vi.spyOn(writerModule, "installSdk").mockResolvedValue();
    vi.spyOn(writerModule, "applyIntegration").mockReturnValue({
      installed: true,
      framework: "React",
      sdkInstalled: true,
      componentPath: "src/components/AsiystAssistant.tsx",
      componentAction: "create" as const,
      entryAction: "update" as const,
    });
    vi.spyOn(writerModule, "inspectIntegration").mockReturnValue({
      initialized: true,
      sdkInstalled: true,
      projectId: TEST_PROJECT_ID,
      publicKey: TEST_PUBLIC_KEY,
    });

    // Prompt responses:
    // 1. "Connect this project to Asiyst?" -> Yes
    // 2. "Open API Keys in your browser?" -> Continue
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: false });

    // Input responses:
    // 1. Domain ready (press Enter)
    // 2. SDK running (press Enter)
    vi.spyOn(secretModule, "readInput")
      .mockResolvedValueOnce("") // Domain Enter
      .mockResolvedValueOnce(""); // Knowledge Enter
    vi.spyOn(secretModule, "readSecret").mockResolvedValueOnce(TEST_API_KEY);

    const requests: { url: string; headers: Headers; body?: unknown }[] = [];
    const mockFetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const urlStr = String(url);
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url: urlStr, headers, body });

      if (urlStr.includes("/cli/onboarding/session")) {
        return new Response(JSON.stringify({
          sessionId: `onboarding_${TEST_SESSION_ID}`,
          userId: TEST_USER_ID,
        }), { status: 201 });
      }
      if (urlStr.includes("/verify/project")) {
        return new Response(JSON.stringify({
          valid: true,
          project: {
            id: TEST_PROJECT_ID,
            name: "My App",
            website: "https://myapp.example",
          },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/domain-verification/status")) {
        return new Response(JSON.stringify({ success: true, verified: true, status: "verified", projectId: TEST_PROJECT_ID }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/sdk/setup")) {
        return new Response(JSON.stringify({
          success: true,
          projectId: TEST_PROJECT_ID,
          sdk: { configured: true, key: TEST_PUBLIC_KEY, created: false },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/sdk/verify")) {
        return new Response(JSON.stringify({
          success: true,
          verified: true,
          projectId: TEST_PROJECT_ID,
          verifiedAt: "2026-09-13T00:00:00Z",
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/projects/") && !urlStr.includes("/avatars/import")) {
        return new Response(JSON.stringify({
          projectId: TEST_PROJECT_ID,
          projectName: "My App",
          domainStatus: "verified",
          website: "https://myapp.example",
          publicKey: TEST_PUBLIC_KEY,
          connectionStatus: "configured",
          publishedConfigurationStatus: "active",
          sdkActivityStatus: "not_detected",
          sdkInitializationStatus: "not_reported",
          sdkVerificationStatus: "pending",
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "handoff_token_123" }), { status: 200 });
      }
      if (urlStr.includes("/api-key/verify")) {
        return new Response(JSON.stringify({
          success: true,
          valid: true,
          projectId: TEST_PROJECT_ID,
          userId: TEST_USER_ID,
        }), { status: 200 });
      }
      if (urlStr.includes("/verify/avatar")) {
        return new Response(JSON.stringify({
          valid: true,
          avatar: {
            avatarId: TEST_AVATAR_ID,
            name: "Assistant Astra",
          },
        }), { status: 200 });
      }
      if (urlStr.includes("/avatars/import")) {
        return new Response(JSON.stringify({
          imported: true,
          avatarId: TEST_AVATAR_ID,
          projectId: TEST_PROJECT_ID,
          publicKey: TEST_PUBLIC_KEY,
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/verification")) {
        return new Response(JSON.stringify([
          { name: "Project", ok: true },
          { name: "Domain", ok: true },
          { name: "SDK", ok: true },
        ]), { status: 200 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const api = new ApiClient("https://example.test", mockFetcher);
    await connectCommand(process.cwd(), api, TEST_PROJECT_ID, TEST_AVATAR_ID);

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Step 1 — Authenticated Account");
    expect(logged).toContain("Step 2 — Project Setup");
    expect(logged).toContain("Step 3 — Domain Verification");
    expect(logged).toContain("Step 4 — API Key");
    expect(logged).toContain("Step 5 — SDK Setup");
    expect(logged).not.toContain("Step 6 — Final Verification");
    expect(logged).not.toContain("Final connection verification failed");
    expect(logged).toContain("Continue SDK setup in your browser:");
    expect(logged).toContain("https://asiyst.com/dashboard/sdk");
    expect(logged).toContain("Domain verified");
    expect(logged).toContain("API key verified");
    expect(logged).toContain("SDK configuration verified");
    expect(logged).toContain("✓ Browser opened.");
    expect(logged).not.toContain("Keep the website open");
    expect(logged).not.toContain("Verifying SDK activity with Asiyst");
    expect(logged).not.toContain("Step 6 — Final Verification");
    expect(logged).toContain("https://asiyst.com/dashboard/sdk");

    const handoffRequests = requests.filter((request) => request.url.includes("/cli/onboarding/handoff"));
    expect(handoffRequests.map((request) => (request.body as { path?: string })?.path)).toEqual([
      "/dashboard/connect/verify",
      "/dashboard/sdk",
    ]);
    expect(handoffRequests.every((request) => request.headers.get("X-Asiyst-Session") === `onboarding_${TEST_SESSION_ID}`)).toBe(true);
    expect(openedUrls).toEqual([
      "https://asiyst.com/cli/onboarding/handoff?token=handoff_token_123",
      "https://asiyst.com/cli/onboarding/handoff?token=handoff_token_123",
    ]);
    expect(requests.some((request) => request.url.includes("/cli/sdk/verify"))).toBe(false);

    // Verify /verify/user was NOT called
    const urls = requests.map((r) => r.url);
    expect(urls.some((u) => u.includes("/verify/user"))).toBe(false);

    // Verify connection was stored
    const saved = await loadConnection(process.cwd());
    expect(saved?.projectId).toBe(TEST_PROJECT_ID);
    expect(saved?.avatarId).toBeUndefined();
    expect(saved?.apiKey).toBe(TEST_API_KEY);
  });

  it("uses the authenticated session to create a web handoff before project setup", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const openedUrls: string[] = [];
    vi.spyOn(openModule, "openBrowser").mockImplementation(async (url) => {
      openedUrls.push(url);
      return true;
    });
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: "new" });
    vi.spyOn(secretModule, "readInput")
      .mockResolvedValueOnce(TEST_PROJECT_ID)
      .mockResolvedValueOnce(undefined);

    const requests: { url: string; headers: Headers; body?: unknown }[] = [];
    const mockFetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const urlStr = String(url);
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url: urlStr, headers, body });
      if (urlStr.endsWith("/cli/onboarding/session")) {
        return new Response(JSON.stringify({ sessionId: "onboarding-session", userId: TEST_USER_ID }), { status: 201 });
      }
      if (urlStr.endsWith("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "project-setup-token" }), { status: 200 });
      }
      if (urlStr.endsWith("/verify/project")) {
        return new Response(JSON.stringify({
          valid: true,
          project: { id: TEST_PROJECT_ID, name: "My App", publicKey: TEST_PUBLIC_KEY },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/domain-verification/status")) {
        return new Response(JSON.stringify({
          success: true,
          verified: true,
          status: "verified",
          projectId: TEST_PROJECT_ID,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await connectCommand(process.cwd(), new ApiClient("https://example.test", mockFetcher));

    const onboarding = requests.find((request) => request.url.endsWith("/cli/onboarding/session"));
    const handoff = requests.find((request) => request.url.endsWith("/cli/onboarding/handoff"));
    const projectVerification = requests.find((request) => request.url.endsWith("/verify/project"));
    expect(onboarding?.headers.get("Authorization")).toBe("Bearer " + TEST_SESSION_ID);
    expect(onboarding?.headers.get("X-Asiyst-Session")).toBe(TEST_SESSION_ID);
    expect(handoff?.headers.get("Authorization")).toBe("Bearer onboarding-session");
    expect(handoff?.headers.get("X-Asiyst-Session")).toBe("onboarding-session");
    expect(onboarding?.body).toEqual({});
    expect(handoff?.body).toEqual({ path: "/dashboard/projects" });
    expect(projectVerification?.headers.get("X-Asiyst-Session")).toBe(TEST_SESSION_ID);
    expect(openedUrls[0]).toBe("https://asiyst.com/cli/onboarding/handoff?token=project-setup-token");
    expect(logSpy.mock.calls.map((call) => call.join(" ")).join("\n")).toContain("Connection cancelled.");
  });

  it("CASE 4: Expired CLI session -> /connect outputs session expired error telling user to run /login", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const openSpy = vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    await connectCommand(process.cwd());

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Session expired or not logged in");
    expect(logged).toContain("/login");
    expect(openSpy).not.toHaveBeenCalled();

    // Session should have been cleared
    const stored = await loadOnboardingSession();
    expect(stored).toBeUndefined();
  });

  it("CASE 5: Run /connect when already connected -> detects already connected and reuses credentials", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });
    await saveConnection(process.cwd(), {
      projectId: TEST_PROJECT_ID,
      apiKey: TEST_API_KEY,
      userId: TEST_USER_ID,
      avatarId: TEST_AVATAR_ID,
      publicKey: TEST_PUBLIC_KEY,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockFetcher = vi.fn(async (url: URL | RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api-key/verify")) {
        return new Response(JSON.stringify({
          success: true,
          valid: true,
          projectId: TEST_PROJECT_ID,
          userId: TEST_USER_ID,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const api = new ApiClient("https://example.test", mockFetcher);
    await connectCommand(process.cwd(), api);

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Asiyst is already connected.");
    expect(logged).not.toContain("Step 1 — Verify User");
  });

  it("CASE 6: /logout then /connect -> authentication required, run /login", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await logoutCommand();

    const logoutLogged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logoutLogged).toContain("Logged out successfully");

    logSpy.mockClear();
    await connectCommand(process.cwd());

    const connectLogged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(connectLogged).toContain("Session expired or not logged in");
    expect(connectLogged).toContain("/login");
  });

  it("CASE 7: Step 4 API-key verification 401 error displays API-key error, preserves session, allows Retry, and succeeds on retry", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);
    vi.spyOn(writerModule, "installSdk").mockResolvedValue();

    // Selectors:
    // 1. Connect this project -> Yes
    // 2. Open API Keys -> Continue (false)
    // 3. Retry on API key error -> Retry (true)
    // 4. Open API Keys on retry -> Continue (false)
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: false })
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: false });

    // Inputs:
    // Domain Enter
    // SDK running Enter
    vi.spyOn(secretModule, "readInput")
      .mockResolvedValueOnce("") // Domain Enter
      .mockResolvedValueOnce(""); // Knowledge Enter

    // Secret inputs:
    // 1. Invalid API key
    // 2. Valid API key
    const INVALID_KEY = "b".repeat(32);
    vi.spyOn(secretModule, "readSecret")
      .mockResolvedValueOnce(INVALID_KEY)
      .mockResolvedValueOnce(TEST_API_KEY);
    vi.spyOn(writerModule, "inspectIntegration").mockReturnValue({
      initialized: true,
      sdkInstalled: true,
      projectId: TEST_PROJECT_ID,
      publicKey: TEST_PUBLIC_KEY,
    });

    let verifyAttempts = 0;
    const mockFetcher = vi.fn(async (url: URL | RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/cli/onboarding/session")) {
        return new Response(JSON.stringify({
          sessionId: `onboarding_${TEST_SESSION_ID}`,
          userId: TEST_USER_ID,
        }), { status: 201 });
      }
      if (urlStr.includes("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "handoff_token_123" }), { status: 200 });
      }
      if (urlStr.includes("/verify/project")) {
        return new Response(JSON.stringify({
          valid: true,
          project: { id: TEST_PROJECT_ID, name: "My App", website: "https://myapp.example" },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/domain-verification/status")) {
        return new Response(JSON.stringify({ success: true, verified: true, status: "verified", projectId: TEST_PROJECT_ID }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/sdk/setup")) {
        return new Response(JSON.stringify({
          success: true,
          projectId: TEST_PROJECT_ID,
          sdk: { configured: true, key: TEST_PUBLIC_KEY, created: false },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/sdk/verify")) {
        return new Response(JSON.stringify({
          success: true,
          verified: true,
          projectId: TEST_PROJECT_ID,
          verifiedAt: "2026-09-13T00:00:00Z",
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/projects/") && !urlStr.includes("/avatars/import")) {
        return new Response(JSON.stringify({
          projectId: TEST_PROJECT_ID,
          projectName: "My App",
          domainStatus: "verified",
          website: "https://myapp.example",
          publicKey: TEST_PUBLIC_KEY,
          connectionStatus: "connected",
          publishedConfigurationStatus: "active",
          sdkActivityStatus: "active",
          sdkInitializationStatus: "initialized",
          sdkVerificationStatus: "verified",
        }), { status: 200 });
      }
      if (urlStr.includes("/api-key/verify")) {
        verifyAttempts += 1;
        if (verifyAttempts === 1) {
          return new Response(JSON.stringify({
            error: "Unauthorized",
            code: "INVALID_API_KEY",
          }), { status: 401 });
        }
        return new Response(JSON.stringify({
          success: true,
          valid: true,
          projectId: TEST_PROJECT_ID,
          userId: TEST_USER_ID,
        }), { status: 200 });
      }
      if (urlStr.includes("/verify/avatar")) {
        return new Response(JSON.stringify({
          valid: true,
          avatar: { avatarId: TEST_AVATAR_ID, name: "Assistant Astra" },
        }), { status: 200 });
      }
      if (urlStr.includes("/avatars/import")) {
        return new Response(JSON.stringify({
          imported: true,
          avatarId: TEST_AVATAR_ID,
          projectId: TEST_PROJECT_ID,
          publicKey: TEST_PUBLIC_KEY,
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/verification")) {
        return new Response(JSON.stringify([
          { name: "Project", ok: true },
          { name: "Domain", ok: true },
          { name: "SDK", ok: true },
        ]), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const api = new ApiClient("https://example.test", mockFetcher);
    await connectCommand(process.cwd(), api, TEST_PROJECT_ID, TEST_AVATAR_ID);

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    // Must show API key failure reason and NOT session expired
    expect(logged).toContain("✗ API key verification failed.");
    expect(logged).toContain("Invalid, revoked, or expired Asiyst API key.");
    expect(logged).not.toContain("Asiyst CLI session expired or was rejected");
    expect(logged).not.toContain("Run /login, then retry /connect.");

    // Must show verifying and success messages on retry
    expect(logged).toContain("→ Verifying API key...");
    expect(logged).toContain("API key verified");
    expect(logged).not.toContain("Step 6 — Final Verification");
    expect(logged).toContain("https://asiyst.com/dashboard/sdk");

    // The raw secret API key must never be logged in plain text
    expect(logged).not.toContain(INVALID_KEY);
    expect(logged).not.toContain(TEST_API_KEY);

    // CLI session remains valid in storage
    const session = await loadOnboardingSession();
    expect(session?.sessionId).toBe(TEST_SESSION_ID);

    // Connection state is saved and status command reflects connected state
    const saved = await loadConnection(process.cwd());
    expect(saved?.projectId).toBe(TEST_PROJECT_ID);
    expect(saved?.apiKey).toBe(TEST_API_KEY);

    logSpy.mockClear();
    await statusCommand(process.cwd(), api);
    const statusLogged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(statusLogged).toContain("Project");
    expect(statusLogged).toContain("Connected");
    expect(statusLogged).toContain("API Key");
    expect(statusLogged).toContain("Verified");
    expect(statusLogged).not.toContain(TEST_API_KEY);
  });

  it("CASE 8: Step 4 API-key verification 403 error on wrong project allows Cancel and preserves CLI session", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);

    // Selectors:
    // 1. Connect this project -> Yes
    // 2. Open API Keys -> Continue (false)
    // 3. Retry prompt on error -> Cancel (false)
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: false })
      .mockResolvedValueOnce({ type: "selected" as const, value: false });

    // Secret input:
    vi.spyOn(secretModule, "readSecret").mockResolvedValueOnce("c".repeat(32));
    vi.spyOn(secretModule, "readInput").mockResolvedValueOnce(""); // Domain Enter

    const mockFetcher = vi.fn(async (url: URL | RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/cli/onboarding/session")) {
        return new Response(JSON.stringify({
          sessionId: `onboarding_${TEST_SESSION_ID}`,
          userId: TEST_USER_ID,
        }), { status: 201 });
      }
      if (urlStr.includes("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "handoff_token_123" }), { status: 200 });
      }
      if (urlStr.includes("/verify/project")) {
        return new Response(JSON.stringify({
          valid: true,
          project: { id: TEST_PROJECT_ID, name: "My App", publicKey: TEST_PUBLIC_KEY },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/domain-verification/status")) {
        return new Response(JSON.stringify({ success: true, verified: true, status: "verified", projectId: TEST_PROJECT_ID }), { status: 200 });
      }
      if (urlStr.includes("/api-key/verify")) {
        return new Response(JSON.stringify({
          error: "Forbidden",
          code: "FORBIDDEN",
        }), { status: 403 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const api = new ApiClient("https://example.test", mockFetcher);
    await connectCommand(process.cwd(), api, TEST_PROJECT_ID, TEST_AVATAR_ID);

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("✗ API key verification failed.");
    expect(logged).toContain("This API key does not belong to the selected project or you do not have access to this project.");
    expect(logged).not.toContain("Asiyst CLI session expired or was rejected");
    expect(logged).toContain("Connection cancelled.");

    // CLI session remains intact
    const session = await loadOnboardingSession();
    expect(session?.sessionId).toBe(TEST_SESSION_ID);
  });
});
