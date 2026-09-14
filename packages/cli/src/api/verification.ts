import { isValidApiKey, isValidAvatarId, isValidProjectId, isValidUserId } from "../config/ids.js";
import type { ConnectedProject } from "../types.js";
import { ASIYST_WEB_URL, SDK_VERIFY_URL, isDebugEnabled } from "../config/api.js";
import { ApiClient } from "./client.js";
import { ApiError, type ApiErrorCode } from "./errors.js";

export interface UserVerificationResult {
  userId: string;
  userName?: string;
}

export interface ProjectVerificationResult {
  userId: string;
  projectId: string;
  projectName?: string;
  website?: string;
  publicKey?: string;
}

export interface AvatarVerificationResult {
  userId: string;
  projectId: string;
  avatarId: string;
  avatarName?: string;
}

export interface ImportSessionResult {
  sessionId: string;
  expiresAt?: string;
}

export interface SdkVerificationResult {
  projectId: string;
  verifiedAt: string;
}

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

function nestedStringValue(body: Record<string, unknown>, containers: string[], ...keys: string[]): string | undefined {
  const direct = stringValue(body, ...keys);
  if (direct) return direct;
  for (const container of containers) {
    const nested = body[container];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const value = stringValue(nested as Record<string, unknown>, ...keys);
      if (value) return value;
    }
  }
  return undefined;
}

function assertValid(value: string, name: string, validator: (candidate: unknown) => boolean): string {
  const trimmed = value.trim();
  if (!validator(trimmed)) {
    const code: ApiErrorCode = name === "User ID"
      ? "INVALID_USER_ID"
      : name === "Project ID"
        ? "INVALID_PROJECT_ID"
        : name === "Avatar ID"
          ? "INVALID_AVATAR_ID"
          : "INVALID_API_KEY";
    throw new ApiError(`Invalid ${name}.`, 400, code);
  }
  return trimmed;
}

function assertVerified(body: Record<string, unknown>, message: string): void {
  const status = stringValue(body, "status", "verificationStatus", "verification_status")?.toLowerCase();
  if (body.valid === false || body.verified === false || body.success === false
    || status === "invalid" || status === "failed" || status === "revoked" || status === "expired") {
    const nestedError = body.error && typeof body.error === "object" && !Array.isArray(body.error)
      ? body.error as Record<string, unknown>
      : undefined;
    const code = (
      stringValue(body, "code", "errorCode", "error_code")
      ?? (typeof body.error === "string" ? body.error : undefined)
      ?? (typeof nestedError?.code === "string" ? nestedError.code : undefined)
    )?.trim().toUpperCase();
    if (code === "API_KEY_REVOKED") throw new ApiError("This API key has been revoked.", 401, "API_KEY_REVOKED");
    if (code === "API_KEY_EXPIRED" || code === "KEY_EXPIRED") throw new ApiError("API key has expired.", 401, "API_KEY_EXPIRED");
    if (code === "API_KEY_NOT_FOUND" || code === "KEY_NOT_FOUND") throw new ApiError("API key was not found.", 404, "API_KEY_NOT_FOUND");
    if (code === "API_KEY_PROJECT_MISMATCH" || code === "KEY_PROJECT_MISMATCH" || code === "WRONG_PROJECT") {
      throw new ApiError("API key does not belong to this project.", 403, "API_KEY_PROJECT_MISMATCH");
    }
    if (code === "UNAUTHORIZED" || code === "AUTH_REQUIRED" || code === "AUTHENTICATION_REQUIRED" || code === "SESSION_EXPIRED") {
      throw new ApiError("Your Asiyst login session has expired. Run /login.", 401, "SESSION_EXPIRED");
    }
    throw new ApiError(stringValue(body, "message", "error") ?? message, 400, "FORBIDDEN");
  }
}

function sessionHeaders(sessionId?: string): HeadersInit {
  return sessionId
    ? {
        Authorization: "Bearer " + sessionId,
        "X-Asiyst-Session": sessionId,
      }
    : {};
}

export async function verifySdk(
  api: ApiClient,
  input: { projectId: string; sessionId: string; publicKey?: string },
): Promise<SdkVerificationResult> {
  const projectId = assertValid(input.projectId, "Project ID", isValidProjectId);
  if (!input.sessionId.trim()) {
    throw new ApiError("Your Asiyst CLI session has expired or is invalid.", 401, "SESSION_EXPIRED");
  }
  let body: Record<string, unknown>;
  try {
    if (isDebugEnabled()) {
      console.error("[asiyst-debug] SDK verification request: POST /cli/sdk/verify");
      console.error(`[asiyst-debug] SDK verification projectId present: ${projectId ? "yes" : "no"}`);
      console.error("[asiyst-debug] SDK verification body fields: projectId");
    }
    body = record(await api.request<unknown>(SDK_VERIFY_URL, {
      method: "POST",
      headers: {
        ...sessionHeaders(input.sessionId),
        ...(input.publicKey ? {
          "X-Asiyst-Project-Id": projectId,
          "X-Asiyst-Public-Key": input.publicKey,
        } : {}),
      },
      body: JSON.stringify({ projectId }),
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "SDK_NOT_ACTIVE") {
        throw new ApiError(
          error.message || "The Asiyst SDK has not connected yet.",
          error.status ?? 409,
          "SDK_NOT_ACTIVE",
        );
      }
      if (error.status === 401) throw new ApiError("Your Asiyst CLI session has expired or is invalid. Run /login and then /connect.", 401, "SESSION_EXPIRED");
      if (error.status === 400) {
        const detail = error.message && !/^Asiyst API returned HTTP 400\.?$/i.test(error.message)
          ? ` ${error.message}`
          : "";
        throw new ApiError(`SDK verification request was rejected.${detail}`, 400, "INVALID_REQUEST");
      }
      if (error.status === 403) throw new ApiError("The SDK or project is not authorized for this Asiyst account.", 403, "FORBIDDEN");
      if (error.status === 404) throw new ApiError("The selected project could not be found.", 404, "PROJECT_NOT_FOUND");
      if (error.status === 409) throw new ApiError("The SDK is installed, but no recent SDK activity was detected. Make sure the SDK is initialized and connected, then retry verification.", 409, "CONFLICT");
      if (error.status === 503) throw new ApiError("Unable to verify SDK because the Asiyst service is temporarily unavailable.", 503, "INTERNAL_ERROR");
      if (error.code === "NETWORK" || error.code === "TIMEOUT") throw new ApiError("Unable to reach the Asiyst SDK verification service. Check your internet connection and try again.", error.status, error.code);
    }
    throw error;
  }
  const returnedProjectId = nestedStringValue(body, ["project"], "projectId", "project_id")
    ?? (typeof body.projectId === "string" ? body.projectId : undefined);
  const verifiedAt = stringValue(body, "verifiedAt", "verified_at");
  if (body.success !== true || body.verified !== true || !returnedProjectId || !verifiedAt) {
    throw new ApiError("Asiyst did not confirm SDK verification.", 200, "MALFORMED_RESPONSE");
  }
  if (returnedProjectId !== projectId) {
    throw new ApiError("Asiyst verified a different project than the one selected.", 409, "PROJECT_MISMATCH");
  }
  return { projectId: returnedProjectId, verifiedAt };
}

export async function verifyUser(api: ApiClient, userId: string, sessionId?: string): Promise<UserVerificationResult> {
  const verifiedUserId = assertValid(userId, "User ID", isValidUserId);
  const body = record(await api.request<unknown>("/verify/user", {
    method: "POST",
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({ userId: verifiedUserId }),
  }));
  assertVerified(body, "User ID verification failed.");
  const returned = nestedStringValue(body, ["user"], "userId", "user_id", "id");
  if (returned !== verifiedUserId) throw new ApiError("The API returned a different User ID.", 200, "USER_MISMATCH");
  return { userId: verifiedUserId, userName: stringValue(body, "userName", "name") };
}

export async function verifyProject(
  api: ApiClient,
  userId: string | undefined,
  projectId: string,
  sessionId?: string,
): Promise<ProjectVerificationResult> {
  const verifiedProjectId = assertValid(projectId, "Project ID", isValidProjectId);
  const verifiedUserId = userId && isValidUserId(userId) ? userId.trim() : undefined;
  const body = record(await api.request<unknown>("/verify/project", {
    method: "POST",
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({
      ...(verifiedUserId ? { userId: verifiedUserId } : {}),
      projectId: verifiedProjectId,
    }),
  }));
  assertVerified(body, "Project verification failed.");
  const returnedProjectId = nestedStringValue(body, ["project"], "projectId", "project_id", "id");
  const returnedUserId = nestedStringValue(body, ["user"], "userId", "user_id", "id");
  if (returnedProjectId && returnedProjectId !== verifiedProjectId) throw new ApiError("The API returned a different Project ID.", 200, "PROJECT_MISMATCH");
  if (returnedUserId && verifiedUserId && returnedUserId !== verifiedUserId) throw new ApiError("The API returned a different User ID.", 200, "USER_MISMATCH");
  return {
    userId: returnedUserId ?? verifiedUserId ?? "",
    projectId: verifiedProjectId,
    projectName: nestedStringValue(body, ["project"], "projectName", "project_name", "name"),
    website: nestedStringValue(body, ["project"], "website", "websiteUrl", "website_url", "domain"),
    publicKey: nestedStringValue(body, ["project"], "publicKey", "public_key", "publishableKey"),
  };
}

export async function verifyApiKeyRelationship(
  api: ApiClient,
  input: { userId?: string; projectId: string; apiKey: string; sessionId?: string },
): Promise<ConnectedProject> {
  const projectId = assertValid(input.projectId, "Project ID", isValidProjectId);
  const apiKey = assertValid(input.apiKey, "API key", isValidApiKey);
  let body: Record<string, unknown>;
  try {
    body = record(await api.request<unknown>(
      `${ASIYST_WEB_URL}/api/v1/projects/${encodeURIComponent(projectId)}/api-key/verify`,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey },
        body: JSON.stringify({}),
      },
    ));
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw new ApiError(
          "Invalid, revoked, or expired Asiyst API key.\nPlease create/copy the secret API key again from Asiyst Dashboard → API Keys.",
          401,
          "INVALID_API_KEY",
        );
      }
      if (error.status === 403) {
        throw new ApiError(
          "This API key does not belong to the selected project or you do not have access to this project.",
          403,
          "API_KEY_PROJECT_MISMATCH",
        );
      }
      if (error.status === 400) {
        throw new ApiError("The API key verification request is invalid.", 400, "INVALID_REQUEST");
      }
      if (error.status === 404) {
        throw new ApiError("The selected project could not be found.", 404, "PROJECT_NOT_FOUND");
      }
      if (error.status === 405) {
        throw new ApiError("API key verification is not available for this request.", 405, "INVALID_REQUEST");
      }
      if (error.status === 503) {
        throw new ApiError("Unable to verify the Asiyst API key right now. Please try again.", 503, "INTERNAL_ERROR");
      }
      if (error.code === "NETWORK" || error.code === "TIMEOUT") {
        throw new ApiError(
          "Unable to reach Asiyst API for API-key verification. Check your internet connection and try again.",
          error.status,
          error.code,
        );
      }
    }
    throw error;
  }
  const returnedProjectId = nestedStringValue(body, ["project"], "projectId", "project_id", "id")
    ?? (typeof body.projectId === "string" ? body.projectId : undefined);
  const returnedUserId = nestedStringValue(body, ["user"], "userId", "user_id", "id")
    ?? (typeof body.userId === "string" ? body.userId : undefined);
  if (body.success !== true || body.valid !== true || !returnedProjectId) {
    throw new ApiError("Received an invalid response while verifying the Asiyst API key.", 200, "MALFORMED_RESPONSE");
  }
  if (returnedProjectId !== projectId) {
    throw new ApiError("This API key does not belong to the selected project or you do not have access to this project.", 403, "API_KEY_PROJECT_MISMATCH");
  }
  return {
    apiKey,
    userId: returnedUserId ?? "",
    projectId,
    projectName: nestedStringValue(body, ["project"], "projectName", "project_name", "name"),
    website: nestedStringValue(body, ["project"], "website", "websiteUrl", "website_url", "domain"),
    publicKey: nestedStringValue(body, ["project"], "publicKey", "public_key", "publishableKey"),
  };
}

export async function verifyAvatar(
  api: ApiClient,
  input: { userId?: string; projectId: string; apiKey: string; avatarId: string; sessionId?: string },
): Promise<AvatarVerificationResult> {
  const projectId = assertValid(input.projectId, "Project ID", isValidProjectId);
  const apiKey = assertValid(input.apiKey, "API key", isValidApiKey);
  const avatarId = assertValid(input.avatarId, "Avatar ID", isValidAvatarId);
  const verifiedUserId = input.userId && isValidUserId(input.userId) ? input.userId.trim() : undefined;
  const body = record(await api.request<unknown>("/verify/avatar", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "X-Asiyst-API-Key": apiKey,
      ...(input.sessionId ? { "X-Asiyst-Session": input.sessionId } : {}),
    },
    body: JSON.stringify({
      ...(verifiedUserId ? { userId: verifiedUserId } : {}),
      projectId,
      apiKey,
      avatarId,
    }),
  }));
  assertVerified(body, "Avatar verification failed.");
  const returnedAvatarId = nestedStringValue(body, ["avatar"], "avatarId", "avatar_id", "id");
  const returnedUserId = nestedStringValue(body, ["user"], "userId", "user_id", "id");
  const returnedProjectId = nestedStringValue(body, ["project"], "projectId", "project_id", "id");
  if (returnedAvatarId && returnedAvatarId !== avatarId) throw new ApiError("The API returned a different Avatar ID.", 200, "AVATAR_MISMATCH");
  if (returnedUserId && verifiedUserId && returnedUserId !== verifiedUserId) throw new ApiError("The API returned a different User ID.", 200, "USER_MISMATCH");
  if (returnedProjectId && returnedProjectId !== projectId) throw new ApiError("The API returned a different Project ID.", 200, "PROJECT_MISMATCH");
  return {
    userId: returnedUserId ?? verifiedUserId ?? "",
    projectId,
    avatarId,
    avatarName: nestedStringValue(body, ["avatar"], "avatarName", "avatar_name", "name"),
  };
}

export async function createImportSession(
  api: ApiClient,
  input: { userId?: string; projectId: string; apiKey: string; avatarId: string; sessionId?: string },
): Promise<ImportSessionResult> {
  const projectId = assertValid(input.projectId, "Project ID", isValidProjectId);
  const apiKey = assertValid(input.apiKey, "API key", isValidApiKey);
  const avatarId = assertValid(input.avatarId, "Avatar ID", isValidAvatarId);
  const verifiedUserId = input.userId && isValidUserId(input.userId) ? input.userId.trim() : undefined;
  const body = record(await api.request<unknown>("/import-session", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "X-Asiyst-API-Key": apiKey,
      ...(input.sessionId ? { "X-Asiyst-Session": input.sessionId } : {}),
    },
    body: JSON.stringify({
      ...(verifiedUserId ? { userId: verifiedUserId } : {}),
      projectId,
      apiKey,
      avatarId,
    }),
  }));
  const sessionId = stringValue(body, "sessionId", "session_id", "id");
  if (!sessionId) throw new ApiError("The API did not return an import session.", 200, "MALFORMED_RESPONSE");
  return { sessionId, expiresAt: stringValue(body, "expiresAt", "expires_at") };
}
