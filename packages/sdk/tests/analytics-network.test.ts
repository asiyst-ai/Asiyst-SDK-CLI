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
  it("surfaces network failures instead of synthesizing a task plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    const client = new Client(
      new HttpTransport({ apiBaseUrl: "https://api.asiyst.com", projectId: "p", publicKey: "k" }),
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
