import type { HighlightStyle, TargetRef } from "../types";

export interface AsiystEventMap {
  "asiyst:initialized": { projectId: string };
  "asiyst:ready": { projectId: string; configVersion: number };
  "asiyst:destroyed": { projectId: string };
  "asiyst:avatar:shown": { name: string };
  "asiyst:avatar:hidden": { name: string };
  "asiyst:avatar:moved": { x: number; y: number };
  "asiyst:target:found": { target: TargetRef; elementId: string };
  "asiyst:target:not-found": { target: TargetRef };
  "asiyst:target:highlighted": { elementId: string; style: HighlightStyle };
  "asiyst:user:clicked": { elementId: string | null };
  "asiyst:task:started": { taskId: string };
  "asiyst:task:step-completed": { taskId: string; stepId: string };
  "asiyst:task:completed": { taskId: string };
  "asiyst:task:failed": { taskId: string; reason: string };
  "asiyst:task:cancelled": { taskId: string };
  "asiyst:conversation:started": { conversationId: string };
  "asiyst:conversation:message": { role: "user" | "assistant"; text: string };
  "asiyst:conversation:closed": { conversationId: string };
  "asiyst:error": { code: string; message: string };
}

export type AsiystEventName = keyof AsiystEventMap;
