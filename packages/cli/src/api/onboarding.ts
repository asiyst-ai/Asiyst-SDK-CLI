import { ApiClient } from "./client.js";
import { ApiError } from "./errors.js";
import { isValidUserId } from "../config/ids.js";
import type { OnboardingSession } from "../types.js";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  const root = value as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root;
  return data;
}

function stringValue(body: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof body[key] === "string" && body[key].trim()) return body[key].trim();
  }
  return undefined;
}

function sessionHeaders(sessionId: string): HeadersInit {
  return {
    Authorization: `Session ${sessionId}`,
    "X-Asiyst-Onboarding-Session": sessionId,
  };
}

export interface WebHandoff {
  token: string;
  expiresAt?: string;
}

const ALLOWED_DESTINATIONS = new Set([
  "/dashboard",
  "/dashboard/profile",
  "/project/new",
  "/dashboard/avatar-studio",
  "/dashboard/knowledge",
  "/dashboard/sdk-installation",
  "/dashboard/sdk-install",
  "/dashboard/api",
  "/dashboard/api-keys",
  "/dashboard/connect-site",
]);

export async function createOnboardingSession(api: ApiClient, userId?: string, authSessionId?: string): Promise<OnboardingSession> {
  const verifiedUserId = userId?.trim();
  if (verifiedUserId && !isValidUserId(verifiedUserId)) {
    throw new ApiError("Invalid User ID.", 400, "INVALID_USER_ID");
  }
  let body: Record<string, unknown>;
  try {
    body = record(await api.request<unknown>("/cli/onboarding/session", {
      method: "POST",
      headers: authSessionId ? { Authorization: `Bearer ${authSessionId}` } : undefined,
      body: JSON.stringify(verifiedUserId ? { userId: verifiedUserId } : {}),
    }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      throw new ApiError(
        "CLI onboarding session endpoint unavailable.\n\nRequired web/backend implementation:\nPOST /cli/onboarding/session\nPOST /cli/onboarding/handoff",
        error.status,
        "NOT_FOUND",
      );
    }
    throw error;
  }
  const sessionId = stringValue(body, "sessionId", "session_id");
  if (!sessionId) throw new ApiError("The API did not return an onboarding session.", 200, "MALFORMED_RESPONSE");
  const returnedUserId = stringValue(body, "userId", "user_id");
  if (returnedUserId && verifiedUserId && returnedUserId !== verifiedUserId) {
    throw new ApiError("The API returned a different User ID.", 200, "USER_MISMATCH");
  }
  return { sessionId, userId: returnedUserId ?? verifiedUserId, expiresAt: stringValue(body, "expiresAt", "expires_at") };
}

export async function createWebHandoff(
  api: ApiClient,
  session: OnboardingSession,
  path: string,
): Promise<WebHandoff> {
  const pathname = path.split("?", 1)[0];
  if (!ALLOWED_DESTINATIONS.has(pathname) || !path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError("Invalid onboarding destination.", 400, "INVALID_REQUEST");
  }
  let body: Record<string, unknown>;
  try {
    body = record(await api.request<unknown>("/cli/onboarding/handoff", {
      method: "POST",
      headers: sessionHeaders(session.sessionId),
      body: JSON.stringify({ path }),
    }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      throw new ApiError(
        "CLI onboarding handoff endpoint unavailable.\n\nRequired web/backend implementation:\nPOST /cli/onboarding/session\nPOST /cli/onboarding/handoff",
        error.status,
        "NOT_FOUND",
      );
    }
    throw error;
  }
  const token = stringValue(body, "handoffToken", "handoff_token", "token");
  if (!token) throw new ApiError("The API did not return a web handoff.", 200, "MALFORMED_RESPONSE");
  return { token, expiresAt: stringValue(body, "expiresAt", "expires_at") };
}
