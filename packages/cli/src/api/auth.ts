import type { ConnectedProject } from "../types.js";
import { VERIFY_KEY_PATH } from "../config/api.js";
import { isValidApiKey, isValidProjectId, isValidUserId } from "../config/ids.js";
import { ApiClient } from "./client.js";
import { ApiError } from "./errors.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function bearerToken(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed.slice(7).trim() : trimmed;
}

function projectFromBody(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const nested = asRecord(body.project) ?? asRecord(body.data);
  const nestedProject = nested ? asRecord(nested.project) ?? nested : undefined;
  return nestedProject ?? body;
}

export function parseVerifyKeyResponse(
  value: unknown,
  apiKey: string,
  expected?: { userId?: string; projectId?: string },
): ConnectedProject {
  const body = asRecord(value);
  if (!body) throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");

  if (body.valid === false) {
    const error = asRecord(body.error);
    const code = (
      typeof body.code === "string" ? body.code
        : typeof body.error === "string" ? body.error
          : typeof error?.code === "string" ? error.code
            : undefined
    )?.trim().toUpperCase();
    if (code === "API_KEY_REVOKED" || body.revoked === true) {
      throw new ApiError("This API key has been revoked.", 401, "API_KEY_REVOKED");
    }
    if (code === "API_KEY_EXPIRED" || code === "KEY_EXPIRED") {
      throw new ApiError("API key has expired.", 401, "API_KEY_EXPIRED");
    }
    if (code === "API_KEY_PROJECT_MISMATCH" || code === "KEY_PROJECT_MISMATCH" || code === "WRONG_PROJECT") {
      throw new ApiError("API key does not belong to this project.", 403, "API_KEY_PROJECT_MISMATCH");
    }
    if (code === "UNAUTHORIZED" || code === "AUTH_REQUIRED" || code === "AUTHENTICATION_REQUIRED" || code === "SESSION_EXPIRED") {
      throw new ApiError("Your Asiyst login session has expired. Run /login.", 401, "SESSION_EXPIRED");
    }
    throw new ApiError("The Asiyst API key was rejected.", 401, "INVALID_API_KEY");
  }

  if (body.valid !== undefined && body.valid !== true) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }

  const project = projectFromBody(body);
  if (!project) throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");

  const projectIdCandidate = project.projectId ?? project.project_id ?? project.projectID ?? project.id;
  const projectId = typeof projectIdCandidate === "string" && isValidProjectId(projectIdCandidate)
    ? projectIdCandidate.trim()
    : undefined;

  if (!projectId) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }

  const website = project.website ?? project.websiteUrl ?? project.url ?? project.domain ?? project.website_url;
  const projectName = project.projectName ?? project.name ?? project.title;
  const publicKey = project.publicKey ?? project.public_key ?? project.publishableKey;
  const data = asRecord(body.data);
  const account = asRecord(body.account) ?? asRecord(body.user) ?? asRecord(data?.account) ?? asRecord(data?.user);
  const userId = project.userId ?? project.user_id ?? project.asiystUserId ?? project.asiyst_user_id
    ?? account?.userId ?? account?.user_id ?? account?.asiystUserId ?? account?.asiyst_user_id
    ?? body.userId ?? body.user_id ?? body.asiystUserId ?? body.asiyst_user_id
    ?? data?.userId ?? data?.user_id ?? data?.asiystUserId ?? data?.asiyst_user_id;
  const parsedUserId = typeof userId === "string" && isValidUserId(userId) ? userId.trim() : undefined;

  if (expected?.projectId && projectId !== expected.projectId.trim()) {
    throw new ApiError("The API key is not authorized for the requested project.", 403, "PROJECT_MISMATCH");
  }
  if (expected?.userId && (!parsedUserId || parsedUserId !== expected.userId.trim())) {
    throw new ApiError("The API key is not authorized for the requested user.", 403, "USER_MISMATCH");
  }

  return {
    projectId,
    projectName: typeof projectName === "string" ? projectName : undefined,
    website: typeof website === "string" ? website : undefined,
    publicKey: typeof publicKey === "string" ? publicKey : undefined,
    apiKey,
    userId: parsedUserId,
  };
}

export async function verifyApiKey(
  api: ApiClient,
  apiKey: string,
  expected?: { userId?: string; projectId?: string },
): Promise<ConnectedProject> {
  const token = bearerToken(apiKey);
  if (!isValidApiKey(token)) throw new ApiError("API key format is invalid.", 400, "INVALID_API_KEY");
  const value = await api.request<unknown>(VERIFY_KEY_PATH, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "X-Asiyst-API-Key": token,
    },
    body: JSON.stringify({
      apiKey: token,
      ...(expected?.userId ? { userId: expected.userId } : {}),
      ...(expected?.projectId ? { projectId: expected.projectId } : {}),
    }),
  });
  return parseVerifyKeyResponse(value, token, expected);
}
