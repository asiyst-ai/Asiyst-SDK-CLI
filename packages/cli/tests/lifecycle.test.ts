import { describe, expect, it, vi } from "vitest";
import { createCliLifecycleEmitter } from "../src/lifecycle.js";

describe("CLI lifecycle events", () => {
  it("supports the required names, deduplicates, and strips credentials", () => {
    const sink = vi.fn();
    const emitter = createCliLifecycleEmitter({
      contract: {
        endpoint: "/api/v1/events",
        status: "unsupported",
        supportedAnalytics: [],
        supportedLifecycleNames: [],
        runtimeCapability: "assistant:telemetry",
        projectBindingRequired: true,
        verifiedInstallationRequired: true,
        browserOriginRequired: true,
        rateLimitRequired: true,
        note: "Lifecycle names prefixed with sdk. or cli. are not dispatched to the current web telemetry endpoint.",
        supported: false,
      },
      emit: sink,
    });

    const first = emitter.emit("cli.authentication_failed", {
      code: "NETWORK",
      commandContext: "login",
      cliVersion: "1.1.4",
      sessionToken: "must-not-send",
    });
    const duplicate = emitter.emit("cli.authentication_failed", {
      code: "NETWORK",
      commandContext: "login",
      cliVersion: "1.1.4",
      sessionToken: "must-not-send",
    });

    expect(first?.payload).toEqual({
      code: "NETWORK",
      commandContext: "login",
      cliVersion: "1.1.4",
    });
    expect(duplicate).toBeUndefined();
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
