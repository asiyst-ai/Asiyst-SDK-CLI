import { describe, expect, it, vi } from "vitest";
import { Analytics } from "../src/analytics/Analytics";
import type { CloudClient } from "../src/communication/CloudClient";
import { CloudClient as Client } from "../src/communication/CloudClient";
import { HttpTransport } from "../src/communication/HttpTransport";
import { NetworkError } from "../src/errors";
import { ConfigManager } from "../src/config/ConfigManager";
import { EventBus } from "../src/events/EventBus";

describe("analytics batching", () => {
  it("flushes a batch asynchronously and retries by keeping events on failure", async () => {
    const sendAnalytics = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const analytics = new Analytics("p1", { sendAnalytics } as unknown as CloudClient);
    analytics.track("task_started", { taskId: "t1" });
    analytics.track("task_completed", { taskId: "t1" });
    expect(analytics.pendingCount()).toBe(2);
    await analytics.flush();
    expect(sendAnalytics).toHaveBeenCalledTimes(1);
    expect(analytics.pendingCount()).toBe(2);
    await analytics.flush();
    expect(analytics.pendingCount()).toBe(0);
  });
});

describe("cloud communication", () => {
  it("sends the initialization heartbeat to the production API with public credentials and origin", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "connected",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetcher);

    const client = new Client(
      new HttpTransport({
        apiBaseUrl: "https://asiyst.com/api/v1",
        projectId: "public_project_7f3a",
        publicKey: "public_sdk_key_abc123",
      }),
      "public_project_7f3a",
      "public_sdk_key_abc123",
    );
    await expect(client.heartbeat({
      origin: "https://www.example.com",
      environment: "production",
      timestamp: "2026-09-15T00:00:00.000Z",
    })).resolves.toMatchObject({ ok: true, status: 200 });

    expect(fetcher).toHaveBeenCalledWith(
      "https://asiyst.com/api/v1/sdk/heartbeat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Asiyst-Project-Id": "public_project_7f3a",
          "X-Asiyst-Public-Key": "public_sdk_key_abc123",
          "X-Asiyst-SDK-Version": "0.1.12",
        }),
      }),
    );
    const firstCall = fetcher.mock.calls[0];
    expect(firstCall).toBeDefined();
    const request = firstCall?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      project_id: "public_project_7f3a",
      public_key: "public_sdk_key_abc123",
      sdk_version: "0.1.12",
      origin: "https://www.example.com",
      environment: "production",
      timestamp: "2026-09-15T00:00:00.000Z",
    });
    expect(JSON.stringify(request.body)).not.toContain("session");
    vi.unstubAllGlobals();
  });

  it("registers an installation with the persistent installation endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      installation_id: "installation-1",
      status: "registered",
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetcher);
    const client = new Client(
      new HttpTransport({
        apiBaseUrl: "https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api",
        projectId: "public_project_7f3a",
        publicKey: "public_sdk_key_abc123",
      }),
      "public_project_7f3a",
      "public_sdk_key_abc123",
    );
    await expect(client.registerInstallation({
      project_id: "public_project_7f3a",
      public_key: "public_sdk_key_abc123",
      installation_id: "installation-1",
      origin: "https://caszio.com",
      environment: "production",
      sdk_version: "0.1.12",
    })).resolves.toMatchObject({ status: "registered" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api/sdk/installations/register",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      project_id: "public_project_7f3a",
      public_key: "public_sdk_key_abc123",
      installation_id: "installation-1",
      origin: "https://caszio.com",
      environment: "production",
      sdk_version: "0.1.12",
    });
    vi.unstubAllGlobals();
  });

  it("surfaces network failures instead of synthesizing a task plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    const client = new Client(
      new HttpTransport({ apiBaseUrl: "https://api.asiyst.com/v1", projectId: "p", publicKey: "k" }),
      "p",
    );
    await expect(client.requestTask("find coupons", "https://shop.example/")).rejects.toBeInstanceOf(NetworkError);
    vi.unstubAllGlobals();
  });

  it("does not treat a failed config fetch as a crash; cached/fallback config remains", async () => {
    const fetchConfig = vi.fn().mockRejectedValue(new NetworkError("down"));
    const manager = new ConfigManager(
      { projectId: "p", publicKey: "k" },
      { fetchConfig } as unknown as CloudClient,
      new EventBus(),
    );
    const before = manager.get();
    const after = await manager.refresh();
    expect(after.avatarName).toBe(before.avatarName);
    expect(fetchConfig).toHaveBeenCalled();
  });
});
