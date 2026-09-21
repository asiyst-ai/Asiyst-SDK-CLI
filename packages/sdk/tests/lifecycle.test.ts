import { describe, expect, it, vi } from "vitest";
import { createSdkLifecycleEmitter, createCliLifecycleEmitter } from "../src/lifecycle";

const sink = vi.fn();

describe("lifecycle emitters", () => {
  it("sanitizes sensitive data and deduplicates repeated events", () => {
    const emitter = createSdkLifecycleEmitter({
      contract: {
        ...{ endpoint: "/api/v1/events", status: "unsupported", supportedAnalytics: ["visitor"], supportedLifecycleNames: [], runtimeCapability: "assistant:telemetry", projectBindingRequired: true, verifiedInstallationRequired: true, browserOriginRequired: true, rateLimitRequired: true, note: "Lifecycle names prefixed with sdk. or cli. are not dispatched to the current web telemetry endpoint." },
        supported: false,
      },
      emit: sink,
    });
    const first = emitter.emit("sdk.verification_started", { projectId: "proj_123", authorization: "Bearer abc", token: "secret", environment: "production" });
    const second = emitter.emit("sdk.verification_started", { projectId: "proj_123", authorization: "Bearer def", token: "secret", environment: "production" });
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
    expect(first?.payload).toEqual({ projectId: "proj_123", environment: "production" });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("supports cli lifecycle names and keeps internal metadata explicit", () => {
    const emitter = createCliLifecycleEmitter();
    const first = emitter.emit("cli.connected", { projectId: "proj_123", connected: true });
    const second = emitter.emit("cli.disconnected", { projectId: "proj_123" });
    expect(first?.name).toBe("cli.connected");
    expect(second?.name).toBe("cli.disconnected");
    expect(first?.contract.supported).toBe(false);
    expect(first?.contract.note).toContain("sdk. or cli.");
  });
});
