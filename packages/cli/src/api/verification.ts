import { isValidApiKey, isValidAvatarId, isValidProjectId, isValidUserId } from "../config/ids.js";
import type { ConnectedProject } from "../types.js";
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
        Authorization: `Bearer ${sessionId}`,
        "X-Asiyst-Session": sessionId,
      }
    : {};
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
  const verifiedUserId = input.userId && isValidUserId(input.userId) ? input.userId.trim() : undefined;
  const body = record(await api.request<unknown>("/verify/api-key", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Asiyst-API-Key": apiKey,
      ...(input.sessionId ? { "X-Asiyst-Session": input.sessionId } : {}),
    },
    body: JSON.stringify({
      ...(verifiedUserId ? { userId: verifiedUserId } : {}),
      projectId,
      apiKey,
    }),
  }));
  assertVerified(body, "API key verification failed.");
  const returnedUserId = nestedStringValue(body, ["user"], "userId", "user_id", "id");
  const returnedProjectId = nestedStringValue(body, ["project"], "projectId", "project_id", "id");
  if (returnedUserId && verifiedUserId && returnedUserId !== verifiedUserId) throw new ApiError("The API returned a different User ID.", 200, "USER_MISMATCH");
  if (returnedProjectId && returnedProjectId !== projectId) throw new ApiError("The API returned a different Project ID.", 200, "PROJECT_MISMATCH");
  return {
    apiKey,
    userId: returnedUserId ?? verifiedUserId ?? "",
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
      Authorization: `Bearer ${apiKey}`,
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
      Authorization: `Bearer ${apiKey}`,
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
