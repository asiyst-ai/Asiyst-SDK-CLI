import type { ActionKind, AssistantMode, ProjectConfig } from "../types";
import { ActionNotAllowedError } from "../errors";

export const DEFAULT_ALLOWED: ActionKind[] = [
  "navigate",
  "highlight",
  "scroll",
  "wait",
  "explain",
  "complete",
];

export function isActionAllowed(
  action: ActionKind,
  config: ProjectConfig,
  source: "developer" | "cloud" | "local",
): boolean {
  if (source === "developer") {
    return true;
  }
  return config.allowedActions.includes(action);
}

export function assertActionAllowed(
  action: ActionKind,
  config: ProjectConfig,
  source: "developer" | "cloud" | "local",
): void {
  if (!isActionAllowed(action, config, source)) {
    throw new ActionNotAllowedError(`Action "${action}" is not permitted for this project`);
  }
}

export function shouldWaitForUser(action: ActionKind, mode: AssistantMode, waitForUser?: boolean): boolean {
  if (waitForUser === true) {
    return true;
  }
  if (waitForUser === false) {
    return false;
  }
  if (mode === "guided" && (action === "click" || action === "type" || action === "select" || action === "navigate")) {
    return true;
  }
  return false;
}
