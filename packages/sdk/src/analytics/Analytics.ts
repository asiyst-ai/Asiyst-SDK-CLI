import { ANALYTICS_BATCH_SIZE, ANALYTICS_FLUSH_INTERVAL_MS } from "../core/constants";
import { CloudClient } from "../communication/CloudClient";

export type AnalyticsName =
  | "assistant_opened"
  | "assistant_closed"
  | "question_started"
  | "question_completed"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "guide_started"
  | "guide_completed"
  | "element_highlighted"
  | "user_clicked_instructed_element"
  | "target_not_found";

export interface AnalyticsEvent {
  name: AnalyticsName;
  at: number;
  projectId: string;
  properties?: Record<string, string | number | boolean>;
}

export class Analytics {
  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private destroyed = false;

  constructor(
    private readonly projectId: string,
    private readonly cloud: CloudClient,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.flush();
    }, ANALYTICS_FLUSH_INTERVAL_MS);
  }

  track(name: AnalyticsName, properties?: AnalyticsEvent["properties"]): void {
    if (this.destroyed) {
      return;
    }
    this.queue.push({
      name,
      at: Date.now(),
      projectId: this.projectId,
      properties,
    });
    if (this.queue.length >= ANALYTICS_BATCH_SIZE) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.slice(0, ANALYTICS_BATCH_SIZE);
    this.queue = this.queue.slice(batch.length);
    try {
      await this.cloud.sendAnalytics(batch);
    } catch {
      this.queue = batch.concat(this.queue).slice(0, 100);
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.flush();
  }

  pendingCount(): number {
    return this.queue.length;
  }
}
