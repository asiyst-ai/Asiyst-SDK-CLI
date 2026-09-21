import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeAuth } from "../src/communication/RuntimeAuth";

const options = {
  apiBaseUrl: "https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api",
  projectId: "public_project_7f3a",
  publicKey: "public_sdk_key_abc123",
  installationId: "inst_Abc12345",
  origin: "https://caszio.com",
  environment: "production" as const,
};

function tokenResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    success: true,
    data: {
      token: "eyJhbGciOiJIUzI1NiJ9.runtime.signature",
      tokenType: "Bearer",
      expiresIn: 300,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      audience: "asiyst-sdk-runtime",
      capabilities: ["assistant:config", "assistant:conversation", "assistant:telemetry", "assistant:heartbeat"],
      ...overrides,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("SDK runtime authentication", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the exact public runtime-token contract and keeps the token in memory", async () => {
    const fetcher = vi.fn().mockResolvedValue(tokenResponse());
    vi.stubGlobal("fetch", fetcher);
    const auth = new RuntimeAuth(options);

    await expect(auth.getToken("assistant:conversation")).resolves.toContain("runtime.signature");
    expect(fetcher).toHaveBeenCalledWith(
      `${options.apiBaseUrl}/sdk/runtime/token`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      projectId: options.projectId,
      publicKey: options.publicKey,
      installationId: options.installationId,
      origin: options.origin,
      environment: options.environment,
      sdkVersion: "0.1.12",
      capabilities: ["assistant:config", "assistant:conversation", "assistant:telemetry", "assistant:heartbeat"],
    });
    expect(JSON.stringify(request.body)).not.toContain("SDK_RUNTIME_SIGNING_SECRET");
  });

  it("coalesces concurrent requests and rejects an invalid audience", async () => {
    const fetcher = vi.fn().mockResolvedValue(tokenResponse({ audience: "dashboard" }));
    vi.stubGlobal("fetch", fetcher);
    const auth = new RuntimeAuth(options);

    await expect(Promise.all([
      auth.getToken("assistant:config"),
      auth.getToken("assistant:heartbeat"),
    ])).rejects.toThrow("invalid runtime authorization response");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
