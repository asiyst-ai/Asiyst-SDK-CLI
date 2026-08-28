import type { HighlightStyle, InitOptions, ProjectConfig, TargetInput, TaskDefinition } from "../types";
import { InitializationError } from "../errors";
import { validateInitOptions } from "../config/schema";
import type { AsiystEventMap } from "../events/types";
import { AsiystRuntime } from "../core/Runtime";
import { withIsolation } from "../core/isolate";

let runtime: AsiystRuntime | undefined;
let initPromise: Promise<void> | undefined;

function requireRuntime(): AsiystRuntime {
  if (!runtime) {
    throw new InitializationError("Call Asiyst.init() before using the SDK");
  }
  return runtime;
}

export const Asiyst = {
  async init(options: InitOptions): Promise<void> {
    if (runtime) {
      throw new InitializationError("Asiyst is already initialized");
    }
    const credentials = validateInitOptions(options);
    const doc = document;
    const win = window;
    runtime = new AsiystRuntime({ ...options, ...credentials }, doc, win);
    initPromise = runtime.start();
    await initPromise;
  },

  async destroy(): Promise<void> {
    if (!runtime) {
      return;
    }
    const current = runtime;
    runtime = undefined;
    initPromise = undefined;
    await current.destroy(window);
  },

  open(): void {
    withIsolation(() => requireRuntime().open());
  },

  close(): void {
    withIsolation(() => requireRuntime().close());
  },

  getConfig(): ProjectConfig {
    return requireRuntime().getConfig();
  },

  getConnectionStatus(): "connected" | "disconnected" | "offline" {
    return requireRuntime().getConnectionStatus();
  },

  avatar: {
    show(): void {
      withIsolation(() => requireRuntime().avatarApi().show());
    },
    hide(): void {
      withIsolation(() => requireRuntime().avatarApi().hide());
    },
    async moveTo(target: TargetInput): Promise<void> {
      await requireRuntime().avatarApi().moveTo(target, "developer");
    },
    async pointAt(target: TargetInput): Promise<void> {
      await requireRuntime().avatarApi().pointAt(target, "developer");
    },
    async highlight(target: TargetInput, style?: HighlightStyle): Promise<void> {
      await requireRuntime().avatarApi().highlight(target, style ?? "outline", "developer");
    },
    speak(message: string): void {
      withIsolation(() => requireRuntime().avatarApi().speak(message));
    },
    think(): void {
      withIsolation(() => requireRuntime().avatarApi().think());
    },
    celebrate(): void {
      withIsolation(() => requireRuntime().avatarApi().celebrate());
    },
    setPosition(x: number, y: number): void {
      withIsolation(() => requireRuntime().avatarApi().setPosition(x, y));
    },
  },

  task: {
    async start(input: string | TaskDefinition): Promise<void> {
      const current = requireRuntime();
      if (typeof input === "string") {
        await current.startTaskFromText(input, document);
        return;
      }
      await current.startTask(input);
    },
    cancel(): void {
      withIsolation(() => requireRuntime().cancelTask());
    },
  },

  workflow: {
    async start(workflowId: string): Promise<void> {
      await requireRuntime().startWorkflow(workflowId);
    },
  },

  on<K extends keyof AsiystEventMap>(event: K, handler: (payload: AsiystEventMap[K]) => void): () => void {
    return requireRuntime().on(event, handler);
  },

  off<K extends keyof AsiystEventMap>(event: K, handler: (payload: AsiystEventMap[K]) => void): void {
    requireRuntime().off(event, handler);
  },
};
