import type { SafeProjectInfo, VerificationResult } from "../types.js";
import { ApiClient } from "./client.js";
import { ApiError } from "./errors.js";

export async function fetchProjectInfo(api: ApiClient, projectId: string): Promise<SafeProjectInfo> {
  const value = await api.request<unknown>(`/cli/projects/${encodeURIComponent(projectId)}`);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  return value as SafeProjectInfo;
}

export async function verifyInstallation(
  api: ApiClient,
  projectId: string,
  publicKey: string,
  domain?: string,
): Promise<VerificationResult[]> {
  const value = await api.request<unknown>("/cli/verification", {
    method: "POST",
    body: JSON.stringify({ projectId, publicKey, domain }),
  });
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string" && typeof (item as Record<string, unknown>).ok === "boolean")) {
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
  return value as VerificationResult[];
}
