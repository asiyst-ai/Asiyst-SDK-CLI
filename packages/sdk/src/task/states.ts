export const TaskStatus = {
  Idle: "idle",
  UserRequest: "user_request",
  IntentDetected: "intent_detected",
  TaskCreated: "task_created",
  TargetResolved: "target_resolved",
  ActionStarted: "action_started",
  WaitingForUser: "waiting_for_user",
  UserActionDetected: "user_action_detected",
  StepCompleted: "step_completed",
  NextStep: "next_step",
  TaskCompleted: "task_completed",
  Failed: "failed",
  Cancelled: "cancelled",
  Timeout: "timeout",
  TargetNotFound: "target_not_found",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  [TaskStatus.Idle]: [TaskStatus.UserRequest],
  [TaskStatus.UserRequest]: [TaskStatus.IntentDetected, TaskStatus.Failed, TaskStatus.Cancelled],
  [TaskStatus.IntentDetected]: [TaskStatus.TaskCreated, TaskStatus.Failed, TaskStatus.Cancelled],
  [TaskStatus.TaskCreated]: [TaskStatus.TargetResolved, TaskStatus.ActionStarted, TaskStatus.Failed, TaskStatus.Cancelled, TaskStatus.TargetNotFound],
  [TaskStatus.TargetResolved]: [
    TaskStatus.ActionStarted,
    TaskStatus.Failed,
    TaskStatus.Cancelled,
    TaskStatus.TargetNotFound,
  ],
  [TaskStatus.ActionStarted]: [
    TaskStatus.WaitingForUser,
    TaskStatus.StepCompleted,
    TaskStatus.Failed,
    TaskStatus.Cancelled,
    TaskStatus.Timeout,
    TaskStatus.TargetNotFound,
  ],
  [TaskStatus.WaitingForUser]: [
    TaskStatus.UserActionDetected,
    TaskStatus.Timeout,
    TaskStatus.Cancelled,
    TaskStatus.Failed,
  ],
  [TaskStatus.UserActionDetected]: [TaskStatus.StepCompleted, TaskStatus.Failed, TaskStatus.Cancelled],
  [TaskStatus.StepCompleted]: [TaskStatus.NextStep, TaskStatus.TaskCompleted, TaskStatus.Cancelled],
  [TaskStatus.NextStep]: [TaskStatus.TargetResolved, TaskStatus.ActionStarted, TaskStatus.Failed, TaskStatus.Cancelled, TaskStatus.TargetNotFound],
  [TaskStatus.TaskCompleted]: [TaskStatus.Idle],
  [TaskStatus.Failed]: [TaskStatus.Idle],
  [TaskStatus.Cancelled]: [TaskStatus.Idle],
  [TaskStatus.Timeout]: [TaskStatus.Idle, TaskStatus.Failed],
  [TaskStatus.TargetNotFound]: [TaskStatus.Idle, TaskStatus.Failed],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: TaskStatus, to: TaskStatus): TaskStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid task transition: ${from} -> ${to}`);
  }
  return to;
}
