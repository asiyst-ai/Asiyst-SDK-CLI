import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api/client.js";
import { consumeLoginChallenge, createLoginChallenge, pollLoginChallenge } from "../src/api/cli-auth.js";

const userId = "A7kP2m-Q9xL4nT8X";

function api(responses: Response[]): ApiClient {
  const fetcher = vi.fn(async () => responses.shift() ?? new Response("{}", { status: 500 }));
  return new ApiClient("https://example.test", fetcher);
}

describe("CLI authentication challenge flow", () => {
  it("uses the authorization URL returned by challenge creation", async () => {
    const challenge = await createLoginChallenge(api([
      new Response(JSON.stringify({
        success: true,
        challengeId: "challenge-1",
        authorizationUrl: "https://asiyst.com/cli/authorize?challenge=challenge-1",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }), { status: 201 }),
    ]), {
      redirectUri: "http://127.0.0.1:12345/callback",
      state: "state",
      cliVersion: "1.1.2",
      platform: "win32",
    });
    expect(challenge.authorizationUrl).toContain("/cli/authorize?challenge=challenge-1");
  });

  it("uses the browser session identifier from the authorization URL", async () => {
    const challenge = await createLoginChallenge(api([
      new Response(JSON.stringify({
        success: true,
        challengeId: "challenge-1",
        authorizationUrl: "https://asiyst.com/cli/authorize?browser_session_id=browser-1&state=state",
      }), { status: 201 }),
    ]), {
      redirectUri: "http://127.0.0.1:12345/callback",
      state: "state",
      cliVersion: "1.1.2",
      platform: "win32",
    });
    expect(challenge.browserSessionId).toBe("browser-1");
  });

  it("keeps pending challenges pending", async () => {
    await expect(pollLoginChallenge(api([
      new Response(JSON.stringify({ status: "pending" }), { status: 200 }),
    ]), "challenge-1")).resolves.toMatchObject({ status: "pending" });
  });

  it("returns approved without consuming it", async () => {
    await expect(pollLoginChallenge(api([
      new Response(JSON.stringify({ status: "approved" }), { status: 200 }),
    ]), "challenge-1")).resolves.toMatchObject({ status: "approved" });
  });

  it("consumes an approved challenge and extracts the session", async () => {
    await expect(consumeLoginChallenge(api([
      new Response(JSON.stringify({
        success: true,
        session: { token: "session-secret", expiresAt: "2030-01-01T00:00:00.000Z" },
        user: { id: userId, email: "user@example.com" },
      }), { status: 200 }),
    ]), "challenge-1")).resolves.toEqual({
      sessionId: "session-secret",
      userId,
      accountEmail: "user@example.com",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

  });

  it("sends the backend issuer field required by the consume contract", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        success: true,
        authenticated: true,
        session: { access_token: "session-secret" },
      }), { status: 200 });
    });
    const callback = {
      browserSessionId: "browser-session",
      code: "one-time-code",
      issuer: "https://asiyst.com",
      state: "state",
    };
    await consumeLoginChallenge(new ApiClient("https://example.test", fetcher), "challenge-1", callback);
    expect(requestBody).toEqual({
      browser_session_id: "browser-session",
      code: "one-time-code",
      issuer: "https://asiyst.com",
      state: "state",
    });
  });

  it("accepts a session credential when identity is returned later by verification", async () => {
    await expect(consumeLoginChallenge(api([
      new Response(JSON.stringify({
        success: true,
        data: { session: { access_token: "session-secret", expires_at: "2030-01-01T00:00:00.000Z" } },
      }), { status: 200 }),
    ]), "challenge-1")).resolves.toMatchObject({
      sessionId: "session-secret",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

  });

  it("preserves a backend refresh credential when one is returned", async () => {
    await expect(consumeLoginChallenge(api([
      new Response(JSON.stringify({
        success: true,
        session: {
          access_token: "session-secret",
          refresh_token: "refresh-secret",
          expires_at: "2030-01-01T00:00:00.000Z",
        },
      }), { status: 200 }),
    ]), "challenge-1")).resolves.toMatchObject({
      sessionId: "session-secret",
      refreshToken: "refresh-secret",
    });
  });

  it("accepts the production-compatible scalar session response", async () => {
    await expect(consumeLoginChallenge(api([
      new Response(JSON.stringify({
        success: true,
        authenticated: true,
        session: "session-secret",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }), { status: 200 }),
    ]), "challenge-1")).resolves.toMatchObject({
      sessionId: "session-secret",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
  });

  it("does not treat not_approved consume responses as success", async () => {
    await expect(consumeLoginChallenge(api([
      new Response(JSON.stringify({ success: false, error: "not_approved" }), { status: 409 }),
    ]), "challenge-1")).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});
