import type { ConnectedProject } from "../types.js";
import { VERIFY_KEY_PATH } from "../config/api.js";
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

export function parseVerifyKeyResponse(value: unknown, apiKey: string): ConnectedProject {
  const body = asRecord(value);
  if (!body) throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");

  if (body.valid === false) {
    const code = typeof body.code === "string" ? body.code : undefined;
    if (code === "API_KEY_REVOKED" || body.revoked === true) {
      throw new ApiError("This API key has been revoked.", 401, "API_KEY_REVOKED");
    }
    throw new ApiError("The Asiyst API key was rejected.", 401, "INVALID_API_KEY");
  }

  if (body.valid !== undefined && body.valid !== true) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }

  const project = projectFromBody(body);
  if (!project) throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");

  const projectId = project.projectId ?? project.project_id ?? project.id ?? project.projectID;
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }

  const website = project.website ?? project.websiteUrl ?? project.url ?? project.domain ?? project.website_url;
  const projectName = project.projectName ?? project.name ?? project.title;
  const publicKey = project.publicKey ?? project.public_key ?? project.publishableKey;

  return {
    projectId: projectId.trim(),
    projectName: typeof projectName === "string" ? projectName : undefined,
    website: typeof website === "string" ? website : undefined,
    publicKey: typeof publicKey === "string" ? publicKey : undefined,
    apiKey,
  };
}

export async function verifyApiKey(api: ApiClient, apiKey: string): Promise<ConnectedProject> {
  const token = bearerToken(apiKey);
  if (!token) throw new ApiError("Invalid API key.", 401, "INVALID_API_KEY");
  const value = await api.request<unknown>(VERIFY_KEY_PATH, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "X-Asiyst-API-Key": token,
    },
    body: JSON.stringify({ apiKey: token }),
  });
  return parseVerifyKeyResponse(value, token);
}
