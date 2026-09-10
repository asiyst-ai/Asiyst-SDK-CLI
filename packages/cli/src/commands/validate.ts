import { verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { ApiClient } from "../api/client.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { inspectIntegration } from "../integration/writer.js";
import { ApiError } from "../api/errors.js";
import { domainVerificationState, fetchProjectInfo } from "../api/projects.js";
import { createApiClient } from "./shared.js";
import { requireAuthenticated } from "./authenticated.js";

export async function validateCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<boolean> {
  if (!(await requireAuthenticated())) return false;
  console.log("\nVALIDATION\n");
  const connection = await loadConnection(cwd);
  const session = await loadOnboardingSession();
  const project = detectProject(cwd);
  const integration = inspectIntegration(project);
  let valid = true;
  const check = (label: string, ok: boolean, detail?: string) => {
    console.log(`${ok ? "✓" : "✕"} ${label}${detail ? `\n  ${detail}` : ""}`);
    valid = valid && ok;
  };
  check("Project configuration", Boolean(connection?.projectId && connection.userId));
  check("API credentials", Boolean(connection?.apiKey));
  try {
    if (!connection?.userId || !connection.projectId || !connection.apiKey) throw new Error("Connect the project first.");
    await verifyApiKeyRelationship(api, { userId: connection.userId, projectId: connection.projectId, apiKey: connection.apiKey, sessionId: session?.sessionId });
  } catch (error) {
    const message = error instanceof ApiError && error.status === 401
      ? "You are not logged in. Run /login."
      : error instanceof ApiError && error.status === 403
        ? "You do not have access to this project."
        : error instanceof ApiError && error.status === 404
          ? "The requested project/domain was not found."
          : error instanceof Error ? error.message : "Backend verification failed.";
    check("API credentials", false, message);
  }
  check("SDK configuration", integration.sdkInstalled && integration.initialized, "Missing required SDK configuration.");
  check("Required files", Boolean(project.packageJson), "package.json is missing.");
  if (connection?.avatarId && connection.userId && connection.projectId && connection.apiKey) {
    try {
      await verifyAvatar(api, { userId: connection.userId, projectId: connection.projectId, apiKey: connection.apiKey, avatarId: connection.avatarId, sessionId: session?.sessionId });
      check("Avatar configuration", true);
    } catch (error) {
      check("Avatar configuration", false, error instanceof Error ? error.message : "Avatar verification failed.");
    }
  } else check("Avatar configuration", false, "No avatar configuration is available.");
  if (connection?.projectId && connection.apiKey) {
    try {
      const projectInfo = await fetchProjectInfo(api, connection.projectId, {
        apiKey: connection.apiKey,
        userId: connection.userId,
        sessionId: session?.sessionId,
      });
      const sdkStatus = projectInfo.connectionStatus?.trim().toLowerCase();
      check("SDK connection", sdkStatus === "connected", sdkStatus === "not_detected"
        ? "SDK has not communicated with the backend."
        : sdkStatus === "inactive" ? "SDK connection is inactive." : "SDK connection status is not available.");
      const domain = projectInfo.website ?? connection.website;
      check("Domain configuration", Boolean(domain), "Connect a domain from the Connect Site page.");
      const domainState = domainVerificationState(projectInfo.domainStatus);
      if (domainState === "verified") check("Domain verification", true);
      else if (domainState === "failed") check("Domain verification", false, "Domain verification failed.");
      else if (domainState === "not_verified") check("Domain verification", false, "Verify your domain from the Connect Site page.");
      else check("Domain verification", false, "Domain verification status is not available.");
    } catch (error) {
      const message = error instanceof ApiError && error.status === 401
        ? "You are not logged in. Run /login."
        : error instanceof ApiError && error.status === 403
          ? "You do not have access to this project."
          : error instanceof ApiError && error.status === 404
            ? "The requested project/domain was not found."
            : error instanceof Error ? error.message : "Domain verification failed.";
      check("Domain configuration", false, message);
      check("Domain verification", false, message);
    }
  } else {
    const detail = connection?.projectId
      ? "Configure an API key before checking the domain."
      : "Connect a project first.";
    check("Domain configuration", false, detail);
    check("Domain verification", false, detail);
  }
  console.log(valid ? "\nNo configuration errors found." : "\nVALIDATION FAILED");
  return valid;
}
