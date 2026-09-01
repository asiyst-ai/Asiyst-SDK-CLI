export type AnchorPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type AssistantMode = "guided" | "assist";

export type ActionKind =
  | "navigate"
  | "click"
  | "highlight"
  | "scroll"
  | "type"
  | "select"
  | "open"
  | "close"
  | "filter"
  | "open-menu"
  | "open-modal"
  | "search"
  | "wait"
  | "explain"
  | "complete";

export const ALL_ACTION_KINDS: readonly ActionKind[] = [
  "navigate",
  "click",
  "highlight",
  "scroll",
  "type",
  "select",
  "open",
  "close",
  "filter",
  "open-menu",
  "open-modal",
  "search",
  "wait",
  "explain",
  "complete",
] as const;

export type HighlightStyle =
  | "spotlight"
  | "outline"
  | "glow"
  | "pointer"
  | "pulse"
  | "dim";

export type ElementKind =
  | "button"
  | "link"
  | "input"
  | "select"
  | "textarea"
  | "form"
  | "navigation"
  | "heading"
  | "menu"
  | "dialog"
  | "tab"
  | "card"
  | "search"
  | "section"
  | "other";

export type TargetSource = "developer" | "cloud" | "local";

export interface TargetRef {
  id?: string;
  role?: string;
  text?: string;
  selector?: string;
}

export type TargetInput = string | TargetRef;

export interface InitOptions {
  projectId: string;
  publicKey: string;
  apiBaseUrl?: string;
  mode?: AssistantMode;
  allowedActions?: ActionKind[];
  observeHistory?: boolean;
}

export interface ThemeConfig {
  accent?: string;
  background?: string;
  text?: string;
}

export interface BehaviorConfig {
  walkingSpeed?: number;
  idleAnimation?: string;
  pointingAnimation?: string;
  greetingAnimation?: string;
  thinkingAnimation?: string;
  successAnimation?: string;
  voiceSpeed?: number;
  speechBubble?: boolean;
}

export interface AvatarRuntimeRule {
  action?: string;
  allowed?: boolean;
  target?: string;
  route?: string;
  routes?: string[];
  domain?: string;
  domains?: string[];
  enabled?: boolean;
  sourceId?: string;
  dataSourceId?: string;
}

export interface AvatarDataSource {
  id: string;
  name?: string;
  type?: string;
  enabled?: boolean;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  credentials?: string;
}

export interface ProjectConfig {
  schemaVersion: number;
  version: number;
  avatarName: string;
  avatar: string;
  size: number;
  position: AnchorPosition;
  voice?: string;
  animation?: string;
  theme: ThemeConfig;
  personality: Record<string, string>;
  behavior: BehaviorConfig;
  mode: AssistantMode;
  allowedActions: ActionKind[];
  allowedDomains: string[];
  allowedRoutes: string[];
  blockedRoutes: string[];
  rules: AvatarRuntimeRule[];
  dataSources: AvatarDataSource[];
  elementSelectors: Record<string, string>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportBox {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MappedElement {
  id: string;
  kind: ElementKind;
  tagName: string;
  role: string | null;
  text: string;
  label: string;
  href: string | null;
  pageUrl: string;
  rect: Rect;
  visible: boolean;
  enabled: boolean;
  developerDefined: boolean;
  description: string | null;
  section: string | null;
}

export interface WebsiteMapSnapshot {
  pageUrl: string;
  path: string;
  title: string;
  capturedAt: number;
  elements: MappedElement[];
}

export interface TaskStep {
  id: string;
  action: ActionKind;
  target?: TargetRef;
  message?: string;
  url?: string;
  value?: string;
  waitForUser?: boolean;
  timeoutMs?: number;
  highlightStyle?: HighlightStyle;
}

export interface TaskDefinition {
  id: string;
  title?: string;
  steps: TaskStep[];
}

export interface WorkflowDefinition {
  id: string;
  title?: string;
  steps: TaskStep[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  text: string;
}

export type { AsiystEventMap } from "../events/types";
