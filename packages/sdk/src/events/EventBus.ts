import type { AsiystEventMap } from "./types";

type Handler<K extends keyof AsiystEventMap> = (payload: AsiystEventMap[K]) => void;

export class EventBus {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  on<K extends keyof AsiystEventMap>(event: K, handler: Handler<K>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    this.listeners.set(event, set);
    return () => this.off(event, handler);
  }

  off<K extends keyof AsiystEventMap>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler as (payload: unknown) => void);
  }

  emit<K extends keyof AsiystEventMap>(event: K, payload: AsiystEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch {
        // Subscriber failures must not break the host page or other listeners.
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
