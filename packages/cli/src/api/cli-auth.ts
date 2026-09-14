import { ApiClient } from "./client.js";
import { ApiError } from "./errors.js";
import { isValidUserId } from "../config/ids.js";
import type { BrowserCallback } from "./callback.js";

const LOGIN_EXCHANGE_TIMEOUT_MS = 30_000;

export interface LoginChallenge {
  challengeId: string;
  browserSessionId: string;
  webLoginUrl: string;
  expiresAt?: string;
}

export interface LoginChallengeStatus {
  status: "pending" | "approved" | "consumed" | "expired" | "cancelled" | "invalid";
  expiresAt?: string;
}

export interface ConsumedLogin {
  userId?: string;
  sessionId: string;
  refreshToken?: string;
  accountEmail?: string;
  expiresAt?: string;
}

export type ExistingSessionValidation =
  | { state: "valid"; accountEmail?: string; userId?: string; expiresAt?: string }
  | { state: "invalid" }
  | { state: "unavailable"; error: ApiError };

export async function validateExistingSession(
  api: ApiClient,
  sessionId: string,
): Promise<ExistingSessionValidation> {
  const token = sessionId.trim();
  if (!token) return { state: "invalid" };

  try {
    const body = record(await api.request<unknown>("/cli/onboarding/session", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "X-Asiyst-Session": token,
      },
      body: JSON.stringify({}),
    }));
    const authenticated = body.authenticated ?? body.valid ?? body.success;
    const onboardingSessionId = nestedText(body, ["session", "onboardingSession"], "sessionId", "session_id", "onboardingSessionId", "onboarding_session_id");
    if (authenticated === false) return { state: "invalid" };
    if (authenticated !== true && !onboardingSessionId) {
      throw new ApiError("Asiyst authentication response was invalid.", 200, "MALFORMED_RESPONSE");
    }
    return {
      state: "valid",
      accountEmail: nestedText(body, ["user", "account"], "accountEmail", "account_email", "email"),
      userId: nestedText(body, ["user", "account"], "userId", "user_id", "id"),
      expiresAt: nestedText(body, ["session"], "expiresAt", "expires_at", "expires"),
    };
  } catch (error) {
    if (error instanceof ApiError && (
      error.status === 401
      || error.code === "SESSION_EXPIRED"
    )) {
      return { state: "invalid" };
    }
    return {
      state: "unavailable",
      error: error instanceof ApiError
        ? error
        : new ApiError("Unable to verify the existing Asiyst session.", undefined, "NETWORK"),
    };
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  const root = value as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : undefined;
  const result = root.result && typeof root.result === "object" && !Array.isArray(root.result)
    ? root.result as Record<string, unknown>
    : undefined;
  return { ...root, ...result, ...data };
}

function text(body: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof body[key] === "string" && body[key].trim()) return body[key].trim();
  }
  return undefined;
}

function nestedText(body: Record<string, unknown>, containers: string[], ...keys: string[]): string | undefined {
  const direct = text(body, ...keys);
  if (direct) return direct;
  for (const container of containers) {
    const value = body[container];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = text(value as Record<string, unknown>, ...keys);
      if (nested) return nested;
    }
  }
  return undefined;
}

export async function createLoginChallenge(api: ApiClient, input: { redirectUri: string; state: string; cliVersion: string; platform: string }): Promise<LoginChallenge> {
  let body: Record<string, unknown>;
  try {
    body = record(await api.request<unknown>("/cli/auth/challenge", {
      method: "POST",
      body: JSON.stringify(input),
    }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      throw new ApiError(
        "Web authentication endpoint unavailable.\n\nRequired web/backend implementation:\nPOST /cli/auth/challenge\nGET /cli/auth/challenge/:challengeId",
        error.status,
        "NOT_FOUND",
      );
    }
    throw error;
  }
  const challengeId = text(body, "challengeId", "challenge_id", "id");
  const webLoginUrl = text(body, "webLoginUrl", "web_login_url");
  if (!challengeId) throw new ApiError("The API did not return a login challenge.", 200, "MALFORMED_RESPONSE");
  if (!webLoginUrl) {
    throw new ApiError(
      "Asiyst authentication response did not include webLoginUrl.",
      200,
      "MALFORMED_RESPONSE",
    );
  }
  let browserSessionId = text(body, "browserSessionId", "browser_session_id", "sessionId", "session_id");
  if (!browserSessionId) {
    try {
      browserSessionId = new URL(webLoginUrl).searchParams.get("browser_session_id")?.trim();
    } catch {
      throw new ApiError("Asiyst authentication response was invalid.", 200, "MALFORMED_RESPONSE");
    }
  }
  if (!browserSessionId) browserSessionId = challengeId;
  return { challengeId, browserSessionId, webLoginUrl, expiresAt: text(body, "expiresAt", "expires_at") };
}

export async function pollLoginChallenge(api: ApiClient, challengeId: string): Promise<LoginChallengeStatus> {
  let body: Record<string, unknown>;
  try {
    body = record(await api.request<unknown>(`/cli/auth/challenge/${encodeURIComponent(challengeId)}`, {
      method: "GET",
    }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      throw new ApiError(
        "Web authentication endpoint unavailable.\n\nRequired web/backend implementation:\nPOST /cli/auth/challenge\nGET /cli/auth/challenge/:challengeId",
        error.status,
        "NOT_FOUND",
      );
    }
    throw error;
  }
  const status = (text(body, "status", "error", "code") ?? "").toLowerCase();
  if (status !== "pending" && status !== "approved" && status !== "consumed"
    && status !== "expired" && status !== "cancelled" && status !== "canceled" && status !== "invalid") {
    throw new ApiError("Asiyst authentication response was invalid.", 200, "MALFORMED_RESPONSE");
  }
  return {
    status: status === "canceled" ? "cancelled" : status,
    expiresAt: text(body, "expiresAt", "expires_at"),
  };
}

export async function consumeLoginChallenge(api: ApiClient, challengeId: string, callback?: BrowserCallback, redirectUri?: string): Promise<ConsumedLogin> {
  let response: unknown;
  let exchangeTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = api.request<unknown>(
      `/cli/auth/challenge/${encodeURIComponent(challengeId)}/consume`,
      {
        method: "POST",
        body: JSON.stringify(callback ? {
          browser_session_id: callback.browserSessionId,
          code: callback.code,
          issuer: callback.issuer,
          state: callback.state,
        } : {}),
      },
    );
    response = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        exchangeTimer = setTimeout(() => reject(new ApiError("CLI authentication timed out.", undefined, "TIMEOUT")), LOGIN_EXCHANGE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      if (error.message.toLowerCase().includes("not_approved")) {
        throw new ApiError("Login authorization is still pending.", 409, "CONFLICT");
      }
      if (error.message.toLowerCase().includes("already_consumed")) {
        throw new ApiError("This login request was already consumed.", 409, "CONFLICT");
      }
    }
    if (error instanceof ApiError && error.code === "TIMEOUT") {
      throw new ApiError("CLI authentication timed out.\n\nPlease run /login again.", undefined, "TIMEOUT");
    }
    if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403)) {
      throw new ApiError("Authorization code is invalid, expired, or has already been used.", error.status, "CONFLICT");
    }
    throw error;
  } finally {
    if (exchangeTimer) clearTimeout(exchangeTimer);
  }
  const body = record(response);
  const rawStatus = text(body, "status", "error", "code")
    ?? (body.error && typeof body.error === "object" && !Array.isArray(body.error)
      ? text(body.error as Record<string, unknown>, "status", "code", "type")
      : undefined);
  const status = rawStatus?.toLowerCase();
  if (body.success === false || body.authenticated === false) {
    if (status === "not_approved") throw new ApiError("Login authorization is still pending.", 409, "CONFLICT");
    if (status === "already_consumed" || status === "code_used") {
      throw new ApiError("This authorization code has already been used.", 409, "CONFLICT");
    }
    if (status === "expired" || status === "code_expired") {
      throw new ApiError("Authorization code expired.", 401, "SESSION_EXPIRED");
    }
    throw new ApiError(
      `Asiyst authentication exchange failed.${rawStatus ? ` Code: ${rawStatus}` : ""}`,
      400,
      "CONFLICT",
    );
  }
  if (status === "not_approved") throw new ApiError("Login authorization is still pending.", 409, "CONFLICT");
  if (status === "already_consumed") throw new ApiError("This login request was already consumed.", 409, "CONFLICT");
  if (status === "expired") throw new ApiError("Login request expired.", 401, "SESSION_EXPIRED");
  if (status === "cancelled" || status === "canceled") throw new ApiError("Login cancelled.", 400, "CONFLICT");
  const sessionId = nestedText(
    body,
    ["session", "cliSession", "auth", "authentication"],
    "sessionId",
    "session_id",
    "cliSessionId",
    "cli_session_id",
    "sessionToken",
    "session_token",
    "token",
    "accessToken",
    "access_token",
    "session",
    "cliSession",
    "id",
  );
  const userId = nestedText(body, ["user", "account"], "userId", "user_id", "id")
    ?? text(body, "userId", "user_id");
  if (!sessionId) {
    throw new ApiError("Asiyst authentication response was invalid.", 200, "MALFORMED_RESPONSE");
  }
  const normalizedUserId = userId && isValidUserId(userId) ? userId : undefined;
  if (process.env.ASIIYST_DEBUG === "1" || process.env.ASIIYST_DEBUG === "true"
    || process.env.ASIYST_DEBUG === "1" || process.env.ASIYST_DEBUG === "true") {
    const token = sessionId;
    console.error(`[asiyst-debug] CLI SESSION authenticated: true`);
    console.error(`[asiyst-debug] token: ${token.slice(0, 4)}…${token.slice(-4)} (${token.length})`);
    console.error(`[asiyst-debug] userId: ${normalizedUserId ?? "absent"}`);
    console.error(`[asiyst-debug] expiresAt: ${text(body, "expiresAt", "expires_at", "expires") ?? "absent"}`);
  }
  return {
    sessionId,
    refreshToken: nestedText(body, ["session", "cliSession"], "refreshToken", "refresh_token"),
    userId: normalizedUserId,
    accountEmail: nestedText(body, ["user", "account"], "accountEmail", "account_email", "email"),
    expiresAt: nestedText(body, ["session", "cliSession"], "expiresAt", "expires_at", "expires")
      ?? text(body, "expiresAt", "expires_at", "expires"),
  };
}
