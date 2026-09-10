import { ASIYST_WEB_URL } from "../config/api.js";
import { muted } from "../ui/format.js";

export const ASIYST_PRODUCTION_ORIGIN = "https://asiyst.com";

const SENSITIVE_QUERY_PARAMS = new Set([
  "token",
  "handofftoken",
  "handoff_token",
  "secret",
  "apikey",
  "api_key",
  "password",
  "code",
  "refreshtoken",
  "refresh_token",
  "sessionid",
  "session_id",
  "auth",
]);

/**
 * Validates and normalizes an Asiyst web destination URL.
 * Strictly enforces https://asiyst.com origin in production and prevents localhost leaks.
 */
export function buildAsiystUrl(path: string, queryParams?: Record<string, string | undefined>): URL {
  if (!path || typeof path !== "string") {
    throw new Error("Invalid URL path provided.");
  }

  // Determine pathname & existing query from input path
  let parsedUrl: URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    parsedUrl = new URL(path);
    if (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "::1") {
      parsedUrl.protocol = "https:";
      parsedUrl.hostname = "asiyst.com";
      parsedUrl.port = "";
    } else if (parsedUrl.origin !== ASIYST_PRODUCTION_ORIGIN && parsedUrl.origin !== ASIYST_WEB_URL) {
      throw new Error(`Invalid URL origin "${parsedUrl.origin}". Expected "${ASIYST_PRODUCTION_ORIGIN}".`);
    }
  } else {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    parsedUrl = new URL(cleanPath, ASIYST_PRODUCTION_ORIGIN);
  }

  if (queryParams) {
    for (const [key, val] of Object.entries(queryParams)) {
      if (val !== undefined && val !== null && val !== "" && val !== "undefined" && val !== "null") {
        parsedUrl.searchParams.set(key, val);
      }
    }
  }

  // Ensure origin is strictly https://asiyst.com
  if (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "::1") {
    parsedUrl.protocol = "https:";
    parsedUrl.hostname = "asiyst.com";
    parsedUrl.port = "";
  }

  return parsedUrl;
}

export function buildProjectNewUrl(): string {
  return buildAsiystUrl("/project/new").toString();
}

export function buildDomainVerificationUrl(projectId: string): string {
  if (!projectId || projectId === "undefined" || projectId === "null") {
    throw new Error("Project ID is required to build domain verification URL.");
  }
  return buildAsiystUrl("/dashboard/connect-site", { projectId }).toString();
}

export function buildApiKeysUrl(projectId: string): string {
  if (!projectId || projectId === "undefined" || projectId === "null") {
    throw new Error("Project ID is required to build API keys URL.");
  }
  return buildAsiystUrl("/dashboard/api-keys", { projectId }).toString();
}

export function buildSdkInstallUrl(projectId: string): string {
  if (!projectId || projectId === "undefined" || projectId === "null") {
    throw new Error("Project ID is required to build SDK installation URL.");
  }
  return buildAsiystUrl("/dashboard/sdk-install", { projectId }).toString();
}

export function buildAvatarStudioUrl(projectId: string): string {
  if (!projectId || projectId === "undefined" || projectId === "null") {
    throw new Error("Project ID is required to build Avatar Studio URL.");
  }
  return buildAsiystUrl("/dashboard/avatar-studio", { projectId }).toString();
}

export function buildKnowledgeUrl(projectId: string, avatarId?: string): string {
  if (!projectId || projectId === "undefined" || projectId === "null") {
    throw new Error("Project ID is required to build Knowledge Base URL.");
  }
  return buildAsiystUrl("/dashboard/knowledge", { projectId, avatarId }).toString();
}

/**
 * Returns a safe URL for logging by redacting sensitive parameters.
 */
export function sanitizeUrlForLogging(url: string | URL): string {
  try {
    const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
    let result = parsed.toString();
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        const val = parsed.searchParams.get(key)!;
        const encoded = encodeURIComponent(val);
        result = result.replace(`${encodeURIComponent(key)}=${encoded}`, `${encodeURIComponent(key)}=REDACTED`);
        result = result.replace(`${key}=${val}`, `${key}=REDACTED`);
      }
    }
    return result;
  } catch {
    return String(url);
  }
}

/**
 * Safely logs the URL being opened without exposing credentials.
 */
export function logOpeningUrl(label: string, url: string | URL): void {
  const safeUrl = sanitizeUrlForLogging(url);
  console.log(`\n→ Opening ${label}`);
  console.log(`  ${muted(safeUrl)}`);
}

/**
 * Extracts the relative path with search params for handoff payloads.
 */
export function toRelativeHandoffPath(url: string | URL): string {
  try {
    const parsed = typeof url === "string" ? (url.startsWith("/") ? new URL(url, ASIYST_PRODUCTION_ORIGIN) : new URL(url)) : url;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return typeof url === "string" && url.startsWith("/") ? url : "/dashboard";
  }
}
