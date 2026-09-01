import type { ActionKind, HighlightStyle, TargetInput, TargetSource, TaskStep } from "../types";
import { TaskExecutionError } from "../errors";
import { AvatarController } from "../avatar/AvatarController";
import { TargetResolver } from "../dom/TargetResolver";
import { assertActionAllowed, shouldWaitForUser } from "./permissions";
import type { ProjectConfig } from "../types";

export interface ActionResult {
  ok: boolean;
  waitedForUser: boolean;
  elementId?: string;
  allowed?: boolean;
  reason?: string;
}

export class InteractionEngine {
  private stopWait: (() => void) | undefined;

  constructor(
    private readonly avatar: AvatarController,
    private readonly resolver: TargetResolver,
    private readonly getConfig: () => ProjectConfig,
    private readonly win: Window,
  ) {}

  cancelWait(): void {
    this.stopWait?.();
  }

  async execute(step: TaskStep, source: TargetSource): Promise<ActionResult> {
    const config = this.getConfig();
    const currentUrl = this.win.location.href;
    const target = step.url ?? (typeof step.target === "string" ? step.target : undefined);
    const allowed = this.evaluatePermission(step.action, config, currentUrl, target, source);
    if (!allowed.ok) {
      return { ok: false, waitedForUser: false, allowed: false, reason: allowed.reason ?? "ACTION_NOT_PERMITTED" };
    }
    const wait = shouldWaitForUser(step.action, config.mode, step.waitForUser);

    switch (step.action) {
      case "explain":
      case "wait":
        if (step.message) {
          this.avatar.speak(step.message);
        }
        return { ok: true, waitedForUser: false };
      case "highlight":
        return this.highlight(step, source, wait);
      case "scroll":
      case "click":
      case "open-menu":
      case "open-modal":
      case "search":
      case "type":
      case "select":
        return this.guideToward(step, source, wait);
      case "navigate":
        return this.navigate(step, source, wait);
      case "complete":
        this.avatar.celebrate();
        if (step.message) {
          this.avatar.speak(step.message);
        }
        return { ok: true, waitedForUser: false };
      default:
        throw new TaskExecutionError("Unsupported action");
    }
  }

  private evaluatePermission(
    action: ActionKind,
    config: ProjectConfig,
    currentUrl: string,
    target: string | undefined,
    source: TargetSource,
  ): { ok: boolean; reason?: string } {
    try {
      assertActionAllowed(action, config, source, currentUrl, target);
      return { ok: true };
    } catch {
      return { ok: false, reason: "ACTION_NOT_PERMITTED" };
    }
  }

  private async highlight(step: TaskStep, source: TargetSource, wait: boolean): Promise<ActionResult> {
    if (!step.target) {
      throw new TaskExecutionError("Highlight requires a target");
    }
    const style: HighlightStyle = step.highlightStyle ?? "outline";
    const elementId = await this.avatar.highlight(step.target, style, source);
    if (step.message) {
      this.avatar.speak(step.message);
    }
    return { ok: true, waitedForUser: wait, elementId };
  }

  private async guideToward(step: TaskStep, source: TargetSource, wait: boolean): Promise<ActionResult> {
    if (!step.target) {
      throw new TaskExecutionError(`${step.action} requires a target`);
    }
    if (step.action === "type" || step.action === "select" || step.action === "click") {
      if (!wait) {
        throw new TaskExecutionError(`${step.action} may only run when the user performs it or waitForUser is enabled`);
      }
    }
    const elementId = await this.avatar.highlight(step.target, step.highlightStyle ?? "pulse", source);
    if (step.message) {
      this.avatar.speak(step.message);
    } else {
      this.avatar.speak(defaultInstruction(step.action, step.target));
    }
    return { ok: true, waitedForUser: true, elementId };
  }

  private async navigate(step: TaskStep, source: TargetSource, wait: boolean): Promise<ActionResult> {
    if (step.target) {
      return this.guideToward(step, source, wait);
    }
    if (!step.url) {
      throw new TaskExecutionError("Navigate requires a target or url");
    }
    if (!wait) {
      throw new TaskExecutionError("Automatic navigation is not enabled");
    }
    if (step.message) {
      this.avatar.speak(step.message);
    }
    return { ok: true, waitedForUser: true };
  }

  waitForElementClick(elementId: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const resolved = this.resolver.tryResolve(elementId, "local");
      if (!resolved) {
        resolve(false);
        return;
      }

      const finish = (clicked: boolean) => {
        this.win.clearTimeout(timer);
        this.win.removeEventListener("click", onClick, true);
        this.stopWait = undefined;
        resolve(clicked);
      };

      const timer = this.win.setTimeout(() => finish(false), timeoutMs);
      const onClick = (event: Event) => {
        const node = event.target;
        if (!(node instanceof Element)) {
          return;
        }
        if (node === resolved.element || resolved.element.contains(node)) {
          finish(true);
        }
      };

      this.stopWait = () => finish(false);
      this.win.addEventListener("click", onClick, true);
    });
  }
}

function defaultInstruction(action: ActionKind, target: TargetInput): string {
  const name = typeof target === "string" ? target : target.id ?? target.text ?? "this control";
  switch (action) {
    case "type":
      return `Type into ${name}.`;
    case "select":
      return `Choose an option in ${name}.`;
    case "navigate":
      return `Open ${name}.`;
    default:
      return `Click ${name}.`;
  }
}
