import { canTransition, TaskStatus, transition } from "./states";
import type { TaskDefinition, TargetSource } from "../types";
import { TargetNotFoundError } from "../errors";
import { Analytics } from "../analytics/Analytics";
import { CloudClient } from "../communication/CloudClient";
import { EventBus } from "../events/EventBus";
import { InteractionEngine } from "../interaction/InteractionEngine";

export class TaskEngine {
  private status: TaskStatus = TaskStatus.Idle;
  private active: TaskDefinition | undefined;
  private abort = false;

  constructor(
    private readonly interaction: InteractionEngine,
    private readonly events: EventBus,
    private readonly analytics: Analytics,
    private readonly cloud: CloudClient,
  ) {}

  getStatus(): TaskStatus {
    return this.status;
  }

  async run(task: TaskDefinition, source: TargetSource): Promise<TaskStatus> {
    this.abort = false;
    this.active = task;
    this.move(TaskStatus.UserRequest);
    this.move(TaskStatus.IntentDetected);
    this.move(TaskStatus.TaskCreated);
    this.events.emit("asiyst:task:started", { taskId: task.id });
    this.analytics.track("task_started", { taskId: task.id });
    this.analytics.track("guide_started", { taskId: task.id });
    void this.cloud.sendTaskUpdate(task.id, this.status);

    try {
      for (const [index, step] of task.steps.entries()) {
        if (this.abort) {
          return TaskStatus.Cancelled;
        }
        if (index > 0) {
          this.move(TaskStatus.NextStep);
        }
        if (step.target) {
          this.move(TaskStatus.TargetResolved);
        }
        this.move(TaskStatus.ActionStarted);

        const result = await this.interaction.execute(step, source);
        if (!result.ok) {
          this.events.emit("asiyst:task:failed", { taskId: task.id, reason: result.reason ?? "ACTION_NOT_PERMITTED" });
          this.analytics.track("task_failed", { taskId: task.id });
          return this.finish(TaskStatus.Failed, result.reason ?? "ACTION_NOT_PERMITTED");
        }
        if (result.waitedForUser && result.elementId) {
          this.move(TaskStatus.WaitingForUser);
          const clicked = await this.interaction.waitForElementClick(result.elementId, step.timeoutMs ?? 30_000);
          if (this.abort) {
            return TaskStatus.Cancelled;
          }
          if (!clicked) {
            this.move(TaskStatus.Timeout);
            return this.finish(TaskStatus.Failed, "Timed out waiting for the user");
          }
          this.move(TaskStatus.UserActionDetected);
          this.events.emit("asiyst:user:clicked", { elementId: result.elementId });
          this.analytics.track("user_clicked_instructed_element", { elementId: result.elementId });
        }

        this.move(TaskStatus.StepCompleted);
        this.events.emit("asiyst:task:step-completed", { taskId: task.id, stepId: step.id });
        void this.cloud.sendTaskUpdate(task.id, this.status, step.id);
      }

      this.move(TaskStatus.TaskCompleted);
      this.events.emit("asiyst:task:completed", { taskId: task.id });
      this.analytics.track("task_completed", { taskId: task.id });
      this.analytics.track("guide_completed", { taskId: task.id });
      void this.cloud.sendTaskUpdate(task.id, this.status);
      this.move(TaskStatus.Idle);
      return TaskStatus.TaskCompleted;
    } catch (error) {
      if (error instanceof TargetNotFoundError) {
        if (canTransition(this.status, TaskStatus.TargetNotFound)) {
          this.move(TaskStatus.TargetNotFound);
        }
        this.events.emit("asiyst:target:not-found", { target: {} });
        this.analytics.track("target_not_found", { taskId: task.id });
        return this.finish(TaskStatus.Failed, error.message);
      }
      const message = error instanceof Error ? error.message : "Task failed";
      return this.finish(TaskStatus.Failed, message);
    }
  }

  cancel(): void {
    this.abort = true;
    this.interaction.cancelWait();
    if (this.status !== TaskStatus.Idle) {
      this.finish(TaskStatus.Cancelled);
    }
  }

  private finish(terminal: TaskStatus, reason?: string): TaskStatus {
    const taskId = this.active?.id ?? "unknown";
    if (this.status !== terminal && canTransition(this.status, terminal)) {
      this.move(terminal);
    }
    if (terminal === TaskStatus.Cancelled) {
      this.events.emit("asiyst:task:cancelled", { taskId });
    } else if (terminal !== TaskStatus.TaskCompleted) {
      this.events.emit("asiyst:task:failed", { taskId, reason: reason ?? terminal });
      this.analytics.track("task_failed", { taskId });
    }
    if (canTransition(this.status, TaskStatus.Idle)) {
      this.move(TaskStatus.Idle);
    } else {
      this.status = TaskStatus.Idle;
    }
    return terminal;
  }

  private move(next: TaskStatus): void {
    this.status = transition(this.status, next);
  }
}
