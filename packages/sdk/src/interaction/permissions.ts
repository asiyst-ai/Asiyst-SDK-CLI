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

function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
}

function matchesRoutePattern(pathname: string, pattern: string): boolean {
  const candidate = pathname || "/";
  const normalized = pattern.trim();
  if (!normalized) {
    return false;
  }
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(candidate);
}

function isLikelyJavaScriptUrl(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:") || lower.includes("eval(") || lower.includes("new function") || lower.includes("document.cookie");
}

export function validateWebsiteDomain(config: ProjectConfig, currentUrl: string): { allowed: boolean; reason?: string } {
  const allowedDomains = config.allowedDomains.map((domain) => normalizeHost(domain));
  if (allowedDomains.length === 0) {
    return { allowed: true };
  }

  try {
    const parsed = new URL(currentUrl);
    const host = normalizeHost(parsed.host);
    const allowed = allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (!allowed) {
      return { allowed: false, reason: "DOMAIN_NOT_AUTHORIZED" };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "DOMAIN_NOT_AUTHORIZED" };
  }
}

export function canNavigateTo(config: ProjectConfig, targetUrl: string, currentUrl: string): { allowed: boolean; reason?: string } {
  if (!targetUrl || typeof targetUrl !== "string") {
    return { allowed: false, reason: "ACTION_NOT_PERMITTED" };
  }
  if (isLikelyJavaScriptUrl(targetUrl)) {
    return { allowed: false, reason: "ACTION_NOT_PERMITTED" };
  }

  let target: URL;
  try {
    target = new URL(targetUrl, currentUrl);
  } catch {
    return { allowed: false, reason: "ACTION_NOT_PERMITTED" };
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return { allowed: false, reason: "ACTION_NOT_PERMITTED" };
  }

  const domainCheck = validateWebsiteDomain(config, currentUrl);
  if (!domainCheck.allowed) {
    return domainCheck;
  }

  const host = normalizeHost(target.host);
  const allowedDomains = config.allowedDomains.map((domain) => normalizeHost(domain));
  if (allowedDomains.length > 0 && !allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return { allowed: false, reason: "DOMAIN_NOT_ALLOWED" };
  }

  const pathname = target.pathname || "/";
  if (config.blockedRoutes.some((route) => matchesRoutePattern(pathname, route))) {
    return { allowed: false, reason: "ROUTE_BLOCKED" };
  }
  if (config.allowedRoutes.length > 0 && !config.allowedRoutes.some((route) => matchesRoutePattern(pathname, route))) {
    return { allowed: false, reason: "ROUTE_NOT_PERMITTED" };
  }
  return { allowed: true };
}

export function evaluateActionPermission(
  action: ActionKind,
  config: ProjectConfig,
  currentUrl: string,
  target?: string,
): { allowed: boolean; reason?: string } {
  const explicitRule = config.rules.find((rule) => rule.action === action && rule.enabled !== false);
  if (explicitRule && typeof explicitRule.allowed === "boolean") {
    if (!explicitRule.allowed) {
      return { allowed: false, reason: "ACTION_NOT_PERMITTED" };
    }
  }

  if (!config.allowedActions.includes(action)) {
    return { allowed: false, reason: "ACTION_NOT_PERMITTED" };
  }

  if (action === "navigate") {
    if (!target) {
      return { allowed: true };
    }
    return canNavigateTo(config, target, currentUrl);
  }

  const allowedDomains = config.allowedDomains;
  if (allowedDomains.length > 0) {
    const domainCheck = validateWebsiteDomain(config, currentUrl);
    if (!domainCheck.allowed) {
      return domainCheck;
    }
  }

  return { allowed: true };
}

export function isActionAllowed(
  action: ActionKind,
  config: ProjectConfig,
  source: "developer" | "cloud" | "local",
  currentUrl?: string,
  target?: string,
): boolean {
  if (source === "developer") {
    return true;
  }
  if (currentUrl) {
    return evaluateActionPermission(action, config, currentUrl, target).allowed;
  }
  return config.allowedActions.includes(action) && !config.rules.some((rule) => rule.action === action && rule.allowed === false);
}

export function assertActionAllowed(
  action: ActionKind,
  config: ProjectConfig,
  source: "developer" | "cloud" | "local",
  currentUrl?: string,
  target?: string,
): void {
  const allowed = isActionAllowed(action, config, source, currentUrl, target);
  if (!allowed) {
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
