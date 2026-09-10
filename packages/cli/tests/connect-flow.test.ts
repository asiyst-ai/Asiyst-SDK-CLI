import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectCommand } from "../src/commands/connect.js";
import { logoutCommand } from "../src/commands/logout.js";
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

  it("CASE 3: Valid CLI session -> full 8-step project-first connect flow completes successfully", async () => {
    await saveOnboardingSession({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      accountEmail: "user@example.com",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(openModule, "openBrowser").mockResolvedValue(true);
    vi.spyOn(writerModule, "installSdk").mockResolvedValue();
    vi.spyOn(writerModule, "applyIntegration").mockReturnValue({
      installed: true,
      framework: "React",
      sdkInstalled: true,
      componentPath: "src/components/AsiystAssistant.tsx",
      componentAction: "create" as const,
      entryAction: "update" as const,
    });

    // Prompt responses:
    // 1. "Connect this project to Asiyst?" -> Yes
    // 2. "Open API Keys in your browser?" -> Continue
    vi.spyOn(selectorModule, "selectOption")
      .mockResolvedValueOnce({ type: "selected" as const, value: true })
      .mockResolvedValueOnce({ type: "selected" as const, value: false });

    // Input responses:
    // 1. Domain ready (press Enter)
    // 2. Knowledge ready (press Enter)
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

      if (urlStr.includes("/verify/project")) {
        return new Response(JSON.stringify({
          valid: true,
          project: {
            id: TEST_PROJECT_ID,
            name: "My App",
            website: "https://myapp.example",
            publicKey: TEST_PUBLIC_KEY,
          },
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/projects/") && !urlStr.includes("/avatars/import")) {
        return new Response(JSON.stringify({
          projectId: TEST_PROJECT_ID,
          projectName: "My App",
          domainStatus: "verified",
          website: "https://myapp.example",
          publicKey: TEST_PUBLIC_KEY,
        }), { status: 200 });
      }
      if (urlStr.includes("/cli/onboarding/handoff")) {
        return new Response(JSON.stringify({ handoffToken: "handoff_token_123" }), { status: 200 });
      }
      if (urlStr.includes("/verify/api-key")) {
        return new Response(JSON.stringify({
          valid: true,
          project: {
            id: TEST_PROJECT_ID,
            name: "My App",
            website: "https://myapp.example",
            publicKey: TEST_PUBLIC_KEY,
          },
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
    expect(logged).toContain("Step 2 — Project Creation / Verification");
    expect(logged).toContain("Step 3 — Domain Verification");
    expect(logged).toContain("Step 4 — API Key");
    expect(logged).toContain("Step 5 — SDK Setup");
    expect(logged).toContain("Step 6 — Avatar Configuration");
    expect(logged).toContain("Step 7 — Knowledge Base");
    expect(logged).toContain("Step 8 — Connection Complete");
    expect(logged).toContain("Account connected");
    expect(logged).toContain("Project connected");
    expect(logged).toContain("Domain verified");
    expect(logged).toContain("API key verified");
    expect(logged).toContain("SDK verified");
    expect(logged).toContain("Avatar verified/imported");
    expect(logged).toContain("Knowledge connected");
    expect(logged).toContain("Knowledge verified");
    expect(logged).toContain("Asiyst connected successfully.");

    // Verify /verify/user was NOT called
    const urls = requests.map((r) => r.url);
    expect(urls.some((u) => u.includes("/verify/user"))).toBe(false);

    // Verify connection was stored
    const saved = await loadConnection(process.cwd());
    expect(saved?.projectId).toBe(TEST_PROJECT_ID);
    expect(saved?.avatarId).toBe(TEST_AVATAR_ID);
    expect(saved?.apiKey).toBe(TEST_API_KEY);
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
      if (urlStr.includes("/verify/api-key")) {
        return new Response(JSON.stringify({
          valid: true,
          project: { id: TEST_PROJECT_ID, name: "My App" },
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
});
