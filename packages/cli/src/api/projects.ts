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
      ...(credentials.sessionId ? { Authorization: "Bearer " + credentials.sessionId } : {}),
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
    sdkActivityStatus: typeof data.sdkActivityStatus === "string"
      ? data.sdkActivityStatus
      : typeof data.sdk_activity_status === "string" ? data.sdk_activity_status : undefined,
    sdkInitializationStatus: typeof data.sdkInitializationStatus === "string"
      ? data.sdkInitializationStatus
      : typeof data.sdk_initialization_status === "string" ? data.sdk_initialization_status : undefined,
    sdkVerificationStatus: typeof data.sdkVerificationStatus === "string"
      ? data.sdkVerificationStatus
      : typeof data.sdk_verification_status === "string" ? data.sdk_verification_status : undefined,
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

export interface DomainVerificationStatus {
  success: boolean;
  verified: boolean;
  status: "verified" | "pending" | "failed" | "expired" | string;
  projectId: string;
  domain?: string;
  verifiedAt?: string;
  errorCode?: string;
  message?: string;
}

export interface SdkSetupResult {
  projectId: string;
  publicKey: string;
  configured: boolean;
  created: boolean;
}

function responseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Asiyst returned an invalid SDK configuration response.", 200, "MALFORMED_RESPONSE");
  }
  const root = value as Record<string, unknown>;
  return root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root;
}

export async function setupSdkConfiguration(
  api: ApiClient,
  projectId: string,
  sessionId: string,
): Promise<SdkSetupResult> {
  const trimmedProjectId = projectId.trim();
  if (!isValidProjectId(trimmedProjectId)) {
    throw new ApiError("SDK configuration requires a valid project ID.", 400, "INVALID_PROJECT_ID");
  }
  const trimmedSessionId = sessionId.trim();
  if (!trimmedSessionId) {
    throw new ApiError("Your Asiyst CLI session has expired or is invalid. Run /login and then /connect.", 401, "SESSION_EXPIRED");
  }
  let value: unknown;
  try {
    value = await api.request<unknown>("/cli/onboarding/sdk/setup", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + trimmedSessionId,
        "X-Asiyst-Session": trimmedSessionId,
      },
      body: JSON.stringify({ projectId: trimmedProjectId }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) throw new ApiError("Your Asiyst CLI session has expired or is invalid. Run /login and then /connect.", 401, "SESSION_EXPIRED");
      if (error.status === 403) throw new ApiError("You do not have access to this project.", 403, "FORBIDDEN");
      if (error.status === 404) throw new ApiError("Project not found.", 404, "PROJECT_NOT_FOUND");
      if (error.status === 409) throw new ApiError("SDK configuration conflict. Please try Step 5 again.", 409, "CONFLICT");
      if (error.status === 429) throw new ApiError("Too many SDK setup requests. Please wait and try again.", 429, "RATE_LIMITED");
      if (error.status === 400) throw new ApiError("Invalid project configuration.", 400, "INVALID_REQUEST");
      if (error.status === 503 || error.status === 500) throw new ApiError("Asiyst could not configure the SDK right now. Please try again.", error.status, "INTERNAL_ERROR");
      if (error.code === "TIMEOUT") throw new ApiError("SDK setup request timed out. Please try again.", error.status, "TIMEOUT");
      if (error.code === "NETWORK") throw new ApiError("Unable to reach the Asiyst API. Check your internet connection and try again.", error.status, "NETWORK");
    }
    throw error;
  }

  const body = responseRecord(value);
  const sdk = body.sdk && typeof body.sdk === "object" && !Array.isArray(body.sdk)
    ? body.sdk as Record<string, unknown>
    : undefined;
  const returnedProjectId = typeof body.projectId === "string"
    ? body.projectId
    : typeof body.project_id === "string" ? body.project_id : undefined;
  const publicKey = typeof sdk?.key === "string" ? sdk.key : undefined;
  if (body.success !== true || sdk?.configured !== true
    || returnedProjectId !== trimmedProjectId || !publicKey?.trim()) {
    throw new ApiError("Asiyst returned an invalid SDK configuration response.", 200, "MALFORMED_RESPONSE");
  }
  return {
    projectId: returnedProjectId,
    publicKey: publicKey.trim(),
    configured: true,
    created: body.created === true || sdk?.created === true,
  };
}

export async function fetchDomainVerificationStatus(
  api: ApiClient,
  projectId: string,
  sessionId: string,
): Promise<DomainVerificationStatus> {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId) {
    throw new ApiError("Project ID is required to check domain verification.", 400, "INVALID_PROJECT_ID");
  }
  let value: unknown;
  try {
    value = await api.request<unknown>(
      `/cli/onboarding/domain-verification/status?projectId=${encodeURIComponent(trimmedProjectId)}`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + sessionId,
          "X-Asiyst-Session": sessionId,
        },
      },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        throw new ApiError("The project ID is missing or malformed.", 400, "INVALID_PROJECT_ID");
      }
      if (error.status === 403) {
        throw new ApiError("You do not have access to this project.", 403, "FORBIDDEN");
      }
      if (error.status === 404) {
        throw new ApiError("The project was not found.", 404, "PROJECT_NOT_FOUND");
      }
      if (error.status === 405) {
        throw new ApiError("Domain verification status endpoint rejected the request method.", 405, "INVALID_REQUEST");
      }
      if (error.status === 503) {
        throw new ApiError("Domain verification status service is temporarily unavailable.", 503, "INTERNAL_ERROR");
      }
    }
    throw error;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Received an unexpected domain verification response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  const root = value as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root;
  const returnedProjectId = typeof data.projectId === "string"
    ? data.projectId
    : typeof data.project_id === "string" ? data.project_id : undefined;
  if (
    data.success !== true
    || typeof data.verified !== "boolean"
    || typeof data.status !== "string"
    || !returnedProjectId
  ) {
    throw new ApiError("Received an unexpected domain verification response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  return {
    success: true,
    verified: data.verified,
    status: data.status,
    projectId: returnedProjectId,
    domain: typeof data.domain === "string" ? data.domain : undefined,
    verifiedAt: typeof data.verifiedAt === "string"
      ? data.verifiedAt
      : typeof data.verified_at === "string" ? data.verified_at : undefined,
    errorCode: typeof data.errorCode === "string"
      ? data.errorCode
      : typeof data.error_code === "string" ? data.error_code : undefined,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

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
      Authorization: "Bearer " + sessionId,
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
  const returnedUserId = body.userId ?? body.user_id;
  const effectiveUserId = (typeof returnedUserId === "string" ? returnedUserId : undefined) ?? userId;
  if (alreadyImported) {
    return {
      imported: true,
      alreadyImported: true,
      avatarId,
      projectId,
      userId: effectiveUserId,
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
  if (returnedUserId !== undefined && userId && returnedUserId !== userId) {
    throw new ApiError("The API returned a different user than requested.", 200, "USER_MISMATCH");
  }
  return {
    imported: true,
    avatarId,
    projectId,
    userId: effectiveUserId,
    avatarName: typeof body.avatarName === "string" ? body.avatarName : undefined,
    publicKey: typeof body.publicKey === "string" ? body.publicKey : undefined,
  };
}

export async function importAvatar(
  api: ApiClient,
  input: { userId?: string; projectId: string; apiKey: string; avatarId: string; sessionId?: string },
): Promise<AvatarImportResult> {
  const projectId = requireIdentifier(input.projectId, "Project ID", isValidProjectId);
  const avatarId = requireIdentifier(input.avatarId, "Avatar ID", isValidAvatarId);
  const apiKey = input.apiKey.trim();
  if (!isValidApiKey(apiKey)) throw new ApiError("API key format is invalid.", 400, "INVALID_API_KEY");
  const userId = input.userId && isValidUserId(input.userId) ? input.userId.trim() : undefined;

  const value = await api.request<unknown>(`/cli/projects/${encodeURIComponent(projectId)}/avatars/import`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "X-Asiyst-API-Key": apiKey,
      ...(input.sessionId ? { "X-Asiyst-Session": input.sessionId } : {}),
    },
    body: JSON.stringify({
      ...(userId ? { userId } : {}),
      projectId,
      avatarId,
    }),
  });
  return parseAvatarImportResponse(value, projectId, userId ?? "", avatarId);
}
