import type { ActionKind, AnchorPosition, BehaviorConfig, ProjectConfig, ThemeConfig } from "../types";
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
    elementSelectors: parseElementSelectors(raw.elementSelectors),
  };
}

export function validateInitOptions(options: {
  projectId?: unknown;
  publicKey?: unknown;
}): { projectId: string; publicKey: string } {
  if (typeof options.projectId !== "string" || !options.projectId.trim()) {
    throw new ConfigurationError("projectId is required");
  }
  if (typeof options.publicKey !== "string" || !options.publicKey.trim()) {
    throw new ConfigurationError("publicKey is required");
  }
  if (options.projectId.length > 128 || options.publicKey.length > 256) {
    throw new ConfigurationError("project credentials exceed allowed length");
  }
  return {
    projectId: options.projectId.trim(),
    publicKey: options.publicKey.trim(),
  };
}
