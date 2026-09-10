import { ApiClient } from "../api/client.js";
import { ApiError } from "../api/errors.js";
import { importAvatar, verifyInstallation } from "../api/projects.js";
import { verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { inspectIntegration, runProjectValidation } from "../integration/writer.js";
import { maskSecret, success, symbols } from "../ui/format.js";
import { createApiClient } from "./shared.js";
import { requireAuthenticated } from "./authenticated.js";

function stringValue(value: unknown, ...keys: string[]): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof body[key] === "string" && body[key].trim()) return body[key].trim();
  }
  return undefined;
}

export async function pushCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  if (!(await requireAuthenticated())) return;
  console.log("\nPreparing push...");

  const connection = await loadConnection(cwd);
  const session = await loadOnboardingSession();
  if (!connection?.userId || !connection.projectId || !connection.apiKey || !connection.avatarId) {
    console.log("✕ Push failed\nReason: No complete verified connection was found.\n\nRun:\n  /connect");
    return;
  }
  if (connection.userId !== session?.userId) {
    console.log("✕ Push failed\nReason: The stored connection does not match the authenticated account.\n\nRun:\n  /login");
    return;
  }

  const project = detectProject(cwd);
  const integration = inspectIntegration(project);
  if (!integration.sdkInstalled || !integration.initialized) {
    console.log("✕ SDK configuration is missing.\n\nRun:\n  /connect");
    return;
  }
  if (integration.projectId !== connection.projectId || integration.avatarId !== connection.avatarId) {
    console.log("✕ Push failed\nReason: The local SDK configuration does not match the verified project and avatar.\n\nRun:\n  /connect");
    return;
  }
  const publicKey = connection.publicKey ?? integration.publicKey;
  if (!publicKey || integration.publicKey !== publicKey) {
    console.log("✕ Push failed\nReason: The local SDK public key does not match the verified project.\n\nRun:\n  /connect");
    return;
  }

  try {
    await verifyApiKeyRelationship(api, {
      userId: connection.userId,
      projectId: connection.projectId,
      apiKey: connection.apiKey,
      sessionId: session.sessionId,
    });
    console.log(`${success(symbols.success)} User authorized`);
    await verifyAvatar(api, {
      userId: connection.userId,
      projectId: connection.projectId,
      apiKey: connection.apiKey,
      avatarId: connection.avatarId,
      sessionId: session.sessionId,
    });
    console.log(`${success(symbols.success)} Project and avatar verified`);
    await runProjectValidation(project);
    console.log(`${success(symbols.success)} Project validation passed`);

    const imported = await importAvatar(api, {
      userId: connection.userId,
      projectId: connection.projectId,
      apiKey: connection.apiKey,
      avatarId: connection.avatarId,
      sessionId: session.sessionId,
    });
    console.log(`${success(symbols.success)} Avatar configuration uploaded${imported.alreadyImported ? " (existing installation updated)" : ""}`);

    const response = await api.request<unknown>(`/cli/projects/${encodeURIComponent(connection.projectId)}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        "X-Asiyst-API-Key": connection.apiKey,
        "X-Asiyst-Session": session.sessionId,
      },
      body: JSON.stringify({
        userId: connection.userId,
        projectId: connection.projectId,
        avatarId: connection.avatarId,
      }),
    });
    const responseStatus = stringValue(response, "status", "state")?.toLowerCase();
    const failed = response && typeof response === "object" && !Array.isArray(response)
      && ((response as Record<string, unknown>).success === false
        || (response as Record<string, unknown>).published === false
        || responseStatus === "failed"
        || responseStatus === "rejected"
        || responseStatus === "error");
    if (failed) {
      throw new ApiError(
        stringValue(response, "message", "error") ?? "The backend rejected the website update.",
        400,
        "IMPORT_FAILED",
      );
    }
    console.log(`${success(symbols.success)} Website configuration updated`);

    const checks = await verifyInstallation(api, connection.projectId, publicKey, connection.website, session.sessionId);
    if (!checks.length || !checks.every((check) => check.ok)) {
      const failedCheck = checks.find((check) => !check.ok);
      throw new ApiError(
        failedCheck?.detail ?? "The connected website did not confirm the avatar deployment.",
        409,
        "IMPORT_FAILED",
      );
    }
    console.log(`${success(symbols.success)} Website deployment verified`);
    console.log(`\n${success(symbols.success)} Avatar pushed successfully`);
    console.log(`${success(symbols.success)} Website updated`);
    console.log(`Avatar ID: ${maskSecret(connection.avatarId)}`);
    console.log(`Project: ${connection.projectName ?? connection.projectId}`);
    if (connection.website) console.log(`Domain: ${connection.website}`);
  } catch (error) {
    const reason = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "The push operation failed.";
    console.log(`✕ Push failed\nReason: ${reason}`);
  }
}
