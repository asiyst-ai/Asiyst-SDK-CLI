import type { ActionKind, AnchorPosition, AvatarDataSource, AvatarRuntimeRule, BehaviorConfig, ProjectConfig, ThemeConfig } from "../types";
import { ALL_ACTION_KINDS } from "../types";
import { ConfigurationError } from "../errors";
import { CONFIG_SCHEMA_VERSION } from "../core/constants";
import { isSafeSelector } from "../security/selectors";
import { sanitizeText } from "../security/sanitize";

const ANCHORS: AnchorPosition[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
];

export const PUBLIC_IDENTIFIER_PATTERN = /^(?=.{1,128}$)[A-Za-z0-9_][A-Za-z0-9_-]*$/;

export function isValidPublicIdentifier(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return false;
  }
  return PUBLIC_IDENTIFIER_PATTERN.test(trimmed);
}

export function isValidProjectId(value: unknown): value is string {
  return isValidPublicIdentifier(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string, max = 80): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return sanitizeText(value, max) || fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function parseAllowedActions(value: unknown, fallback: ActionKind[]): ActionKind[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const allowed = new Set(ALL_ACTION_KINDS);
  const next: ActionKind[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item as ActionKind)) {
      next.push(item as ActionKind);
    }
  }
  return next.length > 0 ? next : [...fallback];
}

function parseStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => sanitizeText(item.trim(), 200))
      .filter(Boolean);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeText(item.trim(), 200))
    .filter(Boolean);
}

function parseRule(value: unknown): AvatarRuntimeRule | null {
  if (!isRecord(value)) return null;
  const action = typeof value.action === "string" ? sanitizeText(value.action, 64) : undefined;
  if (action && !ALL_ACTION_KINDS.includes(action as ActionKind)) {
    return null;
  }

  const routeList = parseStringList(value.routes ?? value.route);
  const domainList = parseStringList(value.domains ?? value.domain);
  const hasAllowedValue = typeof value.allowed === "boolean";
  const hasAnySemanticField =
    hasAllowedValue ||
    typeof value.target === "string" ||
    typeof value.route === "string" ||
    routeList.length > 0 ||
    typeof value.domain === "string" ||
    domainList.length > 0 ||
    typeof value.enabled === "boolean" ||
    typeof value.sourceId === "string" ||
    typeof value.dataSourceId === "string";

  if (!hasAnySemanticField) {
    return null;
  }

  const rule: AvatarRuntimeRule = {
    action,
    allowed: typeof value.allowed === "boolean" ? value.allowed : undefined,
    target: typeof value.target === "string" ? sanitizeText(value.target, 200) : undefined,
    route: typeof value.route === "string" ? sanitizeText(value.route, 200) : undefined,
    routes: routeList,
    domain: typeof value.domain === "string" ? sanitizeText(value.domain, 200) : undefined,
    domains: domainList,
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    sourceId: typeof value.sourceId === "string" ? sanitizeText(value.sourceId, 128) : undefined,
    dataSourceId: typeof value.dataSourceId === "string" ? sanitizeText(value.dataSourceId, 128) : undefined,
  };

  if (typeof value.allowed !== "undefined" && typeof value.allowed !== "boolean") {
    return null;
  }

  return rule;
}

function parseRules(value: unknown): AvatarRuntimeRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rules: AvatarRuntimeRule[] = [];
  for (const entry of value) {
    const rule = parseRule(entry);
    if (rule) {
      rules.push(rule);
    }
  }
  return rules;
}

function parseDataSources(value: unknown): AvatarDataSource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: AvatarDataSource[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === "string" ? sanitizeText(entry.id, 128) : "";
    if (!id) continue;
    next.push({
      id,
      name: typeof entry.name === "string" ? sanitizeText(entry.name, 128) : undefined,
      type: typeof entry.type === "string" ? sanitizeText(entry.type, 64) : undefined,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : undefined,
      url: typeof entry.url === "string" ? sanitizeText(entry.url, 400) : undefined,
      method: typeof entry.method === "string" ? sanitizeText(entry.method, 20) : undefined,
      headers: isRecord(entry.headers)
        ? (() => {
            const safeHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(entry.headers as Record<string, unknown>)) {
              if (typeof value === "string") {
                safeHeaders[sanitizeText(key, 64)] = sanitizeText(value, 200);
              }
            }
            return safeHeaders;
          })()
        : undefined,
      credentials: typeof entry.credentials === "string" ? "[redacted]" : undefined,
    });
  }
  return next;
}

function parseTheme(value: unknown): ThemeConfig {
  if (!isRecord(value)) {
    return {};
  }
  return {
    accent: typeof value.accent === "string" ? sanitizeText(value.accent, 32) : undefined,
    background: typeof value.background === "string" ? sanitizeText(value.background, 32) : undefined,
    text: typeof value.text === "string" ? sanitizeText(value.text, 32) : undefined,
  };
}

function parsePersonality(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && key.length < 40) {
      result[sanitizeText(key, 40)] = sanitizeText(entry, 120);
    }
  }
  return result;
}

function parseBehavior(value: unknown): BehaviorConfig {
  if (!isRecord(value)) {
    return {};
  }
  return {
    walkingSpeed: asNumber(value.walkingSpeed, 1, 0.2, 4),
    idleAnimation: typeof value.idleAnimation === "string" ? sanitizeText(value.idleAnimation, 40) : undefined,
    pointingAnimation:
      typeof value.pointingAnimation === "string" ? sanitizeText(value.pointingAnimation, 40) : undefined,
    greetingAnimation:
      typeof value.greetingAnimation === "string" ? sanitizeText(value.greetingAnimation, 40) : undefined,
    thinkingAnimation:
      typeof value.thinkingAnimation === "string" ? sanitizeText(value.thinkingAnimation, 40) : undefined,
    successAnimation:
      typeof value.successAnimation === "string" ? sanitizeText(value.successAnimation, 40) : undefined,
    voiceSpeed: asNumber(value.voiceSpeed, 1, 0.5, 2),
    speechBubble: typeof value.speechBubble === "boolean" ? value.speechBubble : true,
  };
}

function parseElementSelectors(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [id, selector] of Object.entries(value)) {
    if (typeof selector === "string" && isSafeSelector(selector)) {
      result[sanitizeText(id, 64)] = selector.trim();
    }
  }
  return result;
}

export function fallbackConfig(): ProjectConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: 0,
    avatarName: "Asiyst",
    avatar: "avatar_default",
    size: 96,
    position: "bottom-right",
    animation: "friendly",
    theme: {
      accent: "#2563eb",
      background: "#0f172a",
      text: "#f8fafc",
    },
    personality: {},
    behavior: {
      walkingSpeed: 1,
      speechBubble: true,
    },
    mode: "guided",
    allowedActions: ["navigate", "highlight", "scroll", "wait", "explain", "complete"],
    allowedDomains: [],
    allowedRoutes: [],
    blockedRoutes: [],
    rules: [],
    dataSources: [],
    elementSelectors: {},
  };
}

export function normalizeProjectConfig(raw: unknown): ProjectConfig {
  const base = fallbackConfig();
  if (!isRecord(raw)) {
    return base;
  }

  const position = ANCHORS.includes(raw.position as AnchorPosition)
    ? (raw.position as AnchorPosition)
    : base.position;

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: asNumber(raw.version, base.version, 0, Number.MAX_SAFE_INTEGER),
    avatarName: asString(raw.avatarName, base.avatarName, 40),
    avatar: asString(raw.avatar, base.avatar, 64),
    size: asNumber(raw.size, base.size, 48, 220),
    position,
    voice: typeof raw.voice === "string" ? sanitizeText(raw.voice, 64) : undefined,
    animation: asString(raw.animation, base.animation ?? "friendly", 40),
    theme: { ...base.theme, ...parseTheme(raw.theme) },
    personality: parsePersonality(raw.personality),
    behavior: { ...base.behavior, ...parseBehavior(raw.behavior) },
    mode: raw.mode === "assist" ? "assist" : "guided",
    allowedActions: parseAllowedActions(raw.allowedActions, base.allowedActions),
    allowedDomains: parseStringList(raw.allowedDomains ?? raw.allowed_domains),
    allowedRoutes: parseStringList(raw.allowedRoutes ?? raw.allowed_routes),
    blockedRoutes: parseStringList(raw.blockedRoutes ?? raw.blocked_routes),
    rules: parseRules(raw.rules ?? raw.avatarRules),
    dataSources: parseDataSources(raw.dataSources ?? raw.enabledDataSources),
    elementSelectors: parseElementSelectors(raw.elementSelectors),
  };
}

export function validateInitOptions(options: {
  projectId?: unknown;
  publicKey?: unknown;
  avatarId?: unknown;
  position?: unknown;
}): { projectId: string; publicKey: string; avatarId?: string; position?: AnchorPosition } {
  const projectIdValue = typeof options.projectId === "string" ? options.projectId.trim() : "";
  if (!projectIdValue) {
    throw new ConfigurationError("Asiyst SDK: projectId is required.");
  }
  if (!isValidProjectId(projectIdValue)) {
    throw new ConfigurationError("Asiyst SDK: projectId is invalid. Use a public Project ID.");
  }
  if (typeof options.publicKey !== "string" || !options.publicKey.trim()) {
    throw new ConfigurationError("publicKey is required");
  }
  if (projectIdValue.length > 128 || options.publicKey.trim().length > 256) {
    throw new ConfigurationError("project credentials exceed allowed length");
  }
  const avatarId = typeof options.avatarId === "string" ? options.avatarId.trim() : "";
  if (options.avatarId !== undefined && (!avatarId || avatarId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(avatarId))) {
    throw new ConfigurationError("Asiyst SDK: avatarId is invalid.");
  }
  const position = options.position === undefined ? undefined
    : ANCHORS.includes(options.position as AnchorPosition) ? options.position as AnchorPosition : undefined;
  if (options.position !== undefined && !position) {
    throw new ConfigurationError("Asiyst SDK: position is invalid.");
  }
  return {
    projectId: projectIdValue,
    publicKey: options.publicKey.trim(),
    avatarId: avatarId || undefined,
    position,
  };
}
