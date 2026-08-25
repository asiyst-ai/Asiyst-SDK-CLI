import { describe, expect, it } from "vitest";
import { EventBus } from "../src/events/EventBus";

describe("EventBus", () => {
  it("delivers typed payloads to subscribers", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on("asiyst:ready", (payload) => {
      seen.push(`${payload.projectId}:${payload.configVersion}`);
    });
    bus.emit("asiyst:ready", { projectId: "p1", configVersion: 4 });
    expect(seen).toEqual(["p1:4"]);
  });

  it("isolates subscriber failures", () => {
    const bus = new EventBus();
    bus.on("asiyst:error", () => {
      throw new Error("subscriber crashed");
    });
    const seen: string[] = [];
    bus.on("asiyst:error", (payload) => {
      seen.push(payload.code);
    });
    expect(() => bus.emit("asiyst:error", { code: "x", message: "y" })).not.toThrow();
    expect(seen).toEqual(["x"]);
  });

  it("removes handlers", () => {
    const bus = new EventBus();
    let count = 0;
    const off = bus.on("asiyst:initialized", () => {
      count += 1;
    });
    off();
    bus.emit("asiyst:initialized", { projectId: "p" });
    expect(count).toBe(0);
  });
});
