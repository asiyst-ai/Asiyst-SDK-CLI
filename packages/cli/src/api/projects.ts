import type { ConnectedProject, SafeProjectInfo, VerificationResult } from "../types.js";
import { isValidApiKey, isValidAvatarId, isValidProjectId, isValidUserId } from "../config/ids.js";
import { ApiClient } from "./client.js";
import { ApiError } from "./errors.js";

export async function fetchProjectInfo(
  api: ApiClient,
  projectId: string,
  credentials?: { apiKey?: string; userId?: string; sessionId?: string },
): Promise<SafeProjectInfo> {
  const value = await api.request<unknown>(`/cli/projects/${encodeURIComponent(projectId)}`, credentials ? {
    headers: {
      ...(credentials.sessionId ? { Authorization: `Bearer ${credentials.sessionId}` } : {}),
      ...(credentials.sessionId ? { "X-Asiyst-Session": credentials.sessionId } : {}),
      ...(credentials.apiKey ? { "X-Asiyst-API-Key": credentials.apiKey } : {}),
      ...(credentials.userId ? { "X-Asiyst-User-ID": credentials.userId } : {}),
    },
  } : undefined);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  const root = value as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root;
  return {
    projectName: typeof data.projectName === "string" ? data.projectName : undefined,
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    connectionStatus: typeof data.connectionStatus === "string" ? data.connectionStatus : undefined,
    lastSdkConnection: typeof data.lastSdkConnection === "string" ? data.lastSdkConnection : undefined,
    domainStatus: typeof data.domainStatus === "string"
      ? data.domainStatus
      : typeof data.domainVerificationStatus === "string" ? data.domainVerificationStatus : undefined,
    avatarStatus: typeof data.avatarStatus === "string" ? data.avatarStatus : undefined,
    publishedConfigurationStatus: typeof data.publishedConfigurationStatus === "string" ? data.publishedConfigurationStatus : undefined,
    publicKey: typeof data.publicKey === "string" ? data.publicKey : undefined,
    website: typeof data.website === "string"
      ? data.website
      : typeof data.domain === "string" ? data.domain : undefined,
  };
}

export type DomainVerificationState = "verified" | "not_verified" | "failed" | "unavailable";

export function domainVerificationState(domainStatus: string | undefined): DomainVerificationState {
  if (!domainStatus) return "unavailable";
  const normalized = domainStatus.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["verified", "active", "connected", "success", "succeeded"].includes(normalized)) return "verified";
  if (["not_verified", "unverified", "pending", "not_connected", "inactive"].includes(normalized)) return "not_verified";
  if (["failed", "failure", "error", "verification_failed"].includes(normalized)) return "failed";
  return "unavailable";
}

export async function verifyInstallation(
  api: ApiClient,
  projectId: string,
  publicKey: string,
  domain?: string,
  sessionId?: string,
): Promise<VerificationResult[]> {
  const value = await api.request<unknown>("/cli/verification", {
    method: "POST",
    headers: sessionId ? {
      Authorization: `Bearer ${sessionId}`,
      "X-Asiyst-Session": sessionId,
    } : undefined,
    body: JSON.stringify({ projectId, publicKey, domain }),
  });
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string" && typeof (item as Record<string, unknown>).ok === "boolean")) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  return value as VerificationResult[];
}

export interface AvatarImportResult {
  imported: boolean;
  avatarId: string;
  projectId: string;
  userId: string;
  avatarName?: string;
  publicKey?: string;
  alreadyImported?: boolean;
}

function requireIdentifier(value: string, name: string, valid: (candidate: unknown) => boolean): string {
  const trimmed = value.trim();
  if (!valid(trimmed)) throw new ApiError(`Invalid ${name}.`, 400, "INVALID_REQUEST");
  return trimmed;
}

function parseAvatarImportResponse(value: unknown, projectId: string, userId: string, avatarId: string): AvatarImportResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  const response = value as Record<string, unknown>;
  const body = response.data && typeof response.data === "object" && !Array.isArray(response.data)
    ? response.data as Record<string, unknown>
    : response;
  const imported = body.imported === true || body.success === true || body.status === "imported";
  const alreadyImported = body.code === "AVATAR_ALREADY_IMPORTED" || body.status === "already_imported";
  if (alreadyImported) {
    return {
      imported: true,
      alreadyImported: true,
      avatarId,
      projectId,
      userId,
      avatarName: typeof body.avatarName === "string" ? body.avatarName : undefined,
      publicKey: typeof body.publicKey === "string" ? body.publicKey : undefined,
    };
  }
  if (!imported) {
    const code = typeof body.code === "string" ? body.code : "IMPORT_FAILED";
    const supportedCode = ["AVATAR_NOT_FOUND", "AVATAR_ALREADY_IMPORTED", "FORBIDDEN", "PROJECT_NOT_FOUND", "CONFLICT"].includes(code)
      ? code as "AVATAR_NOT_FOUND" | "AVATAR_ALREADY_IMPORTED" | "FORBIDDEN" | "PROJECT_NOT_FOUND" | "CONFLICT"
      : "IMPORT_FAILED";
    throw new ApiError(typeof body.message === "string" ? body.message : "Avatar import was not completed.", 200, supportedCode);
  }
  const returnedAvatarId = body.avatarId ?? body.avatar_id;
  if (returnedAvatarId !== undefined && returnedAvatarId !== avatarId) {
    throw new ApiError("The API returned a different avatar than requested.", 200, "AVATAR_MISMATCH");
  }
  const returnedProjectId = body.projectId ?? body.project_id;
  if (returnedProjectId !== undefined && returnedProjectId !== projectId) {
    throw new ApiError("The API returned a different project than requested.", 200, "PROJECT_MISMATCH");
  }
  const returnedUserId = body.userId ?? body.user_id;
  if (returnedUserId !== undefined && returnedUserId !== userId) {
    throw new ApiError("The API returned a different user than requested.", 200, "USER_MISMATCH");
  }
  return {
    imported: true,
    avatarId,
    projectId,
    userId,
    avatarName: typeof body.avatarName === "string" ? body.avatarName : undefined,
    publicKey: typeof body.publicKey === "string" ? body.publicKey : undefined,
  };
}

export async function importAvatar(
  api: ApiClient,
  input: { userId: string; projectId: string; apiKey: string; avatarId: string; sessionId?: string },
): Promise<AvatarImportResult> {
  const userId = requireIdentifier(input.userId, "User ID", isValidUserId);
  const projectId = requireIdentifier(input.projectId, "Project ID", isValidProjectId);
  const avatarId = requireIdentifier(input.avatarId, "Avatar ID", isValidAvatarId);
  const apiKey = input.apiKey.trim();
  if (!isValidApiKey(apiKey)) throw new ApiError("API key format is invalid.", 400, "INVALID_API_KEY");

  const value = await api.request<unknown>(`/cli/projects/${encodeURIComponent(projectId)}/avatars/import`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "X-Asiyst-API-Key": apiKey,
      ...(input.sessionId ? { "X-Asiyst-Session": input.sessionId } : {}),
    },
    body: JSON.stringify({ userId, projectId, avatarId }),
  });
  return parseAvatarImportResponse(value, projectId, userId, avatarId);
}
