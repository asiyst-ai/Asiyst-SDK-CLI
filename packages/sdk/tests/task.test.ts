import { describe, expect, it } from "vitest";
import { canTransition, TaskStatus, transition } from "../src/task/states";
import { TaskEngine } from "../src/task/TaskEngine";
import { EventBus } from "../src/events/EventBus";
import { Analytics } from "../src/analytics/Analytics";
import type { InteractionEngine } from "../src/interaction/InteractionEngine";
import type { CloudClient } from "../src/communication/CloudClient";
import { TargetNotFoundError } from "../src/errors";
import { assertActionAllowed } from "../src/interaction/permissions";
import { fallbackConfig } from "../src/config/schema";
import { ActionNotAllowedError } from "../src/errors";

function createEngine(interaction: Partial<InteractionEngine>) {
  const events = new EventBus();
  const cloud = {
    sendAnalytics: async () => undefined,
    sendTaskUpdate: async () => undefined,
  } as unknown as CloudClient;
  const analytics = new Analytics("p1", cloud);
  const engine = new TaskEngine(interaction as InteractionEngine, events, analytics, cloud);
  return { engine, events };
}

describe("task state machine", () => {
  it("allows the guided-mode path and rejects illegal jumps", () => {
    expect(canTransition(TaskStatus.Idle, TaskStatus.UserRequest)).toBe(true);
    expect(canTransition(TaskStatus.WaitingForUser, TaskStatus.UserActionDetected)).toBe(true);
    expect(canTransition(TaskStatus.Idle, TaskStatus.TaskCompleted)).toBe(false);
    expect(() => transition(TaskStatus.Idle, TaskStatus.Failed)).toThrow(/Invalid task transition/);
  });

  it("walks a guided step to completion when the user clicks the target", async () => {
    const { engine, events } = createEngine({
      execute: async () => ({ ok: true, waitedForUser: true, elementId: "coupons" }),
      waitForElementClick: async () => true,
      cancelWait() {},
    });
    const completed: string[] = [];
    events.on("asiyst:task:completed", (payload) => completed.push(payload.taskId));

    const status = await engine.run(
      {
        id: "task_1",
        steps: [{ id: "s1", action: "click", target: { id: "coupons" }, message: "Click Coupons" }],
      },
      "cloud",
    );

    expect(status).toBe(TaskStatus.TaskCompleted);
    expect(completed).toEqual(["task_1"]);
    expect(engine.getStatus()).toBe(TaskStatus.Idle);
  });

  it("records target-not-found without leaving the machine in a mixed boolean state", async () => {
    const { engine } = createEngine({
      execute: async () => {
        throw new TargetNotFoundError("missing");
      },
      waitForElementClick: async () => false,
      cancelWait() {},
    });

    const status = await engine.run(
      {
        id: "task_2",
        steps: [{ id: "s1", action: "highlight", target: { id: "nope" } }],
      },
      "cloud",
    );

    expect(status).toBe(TaskStatus.Failed);
    expect(engine.getStatus()).toBe(TaskStatus.Idle);
  });

  it("times out while waiting for the user", async () => {
    const { engine } = createEngine({
      execute: async () => ({ ok: true, waitedForUser: true, elementId: "filters" }),
      waitForElementClick: async () => false,
      cancelWait() {},
    });
    const status = await engine.run(
      { id: "task_3", steps: [{ id: "s1", action: "click", target: { id: "filters" } }] },
      "cloud",
    );
    expect(status).toBe(TaskStatus.Failed);
  });
});

describe("action validation", () => {
  it("blocks cloud click when the project did not allow it", () => {
    const config = fallbackConfig();
    expect(() => assertActionAllowed("click", config, "cloud")).toThrow(ActionNotAllowedError);
    expect(() => assertActionAllowed("highlight", config, "cloud")).not.toThrow();
    expect(() => assertActionAllowed("click", config, "developer")).not.toThrow();
  });
});
