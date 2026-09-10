import { verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { ApiClient } from "../api/client.js";
import { ApiError } from "../api/errors.js";
import { domainVerificationState, fetchProjectInfo } from "../api/projects.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { inspectIntegration } from "../integration/writer.js";
import { createApiClient } from "./shared.js";
import { requireAuthenticated } from "./authenticated.js";

export async function testCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  if (!(await requireAuthenticated())) return;
  console.log("\nASIYST INTEGRATION TEST\n");
  const connection = await loadConnection(cwd);
  const session = await loadOnboardingSession();
  const project = detectProject(cwd);
  let passed = true;
  const check = (label: string, ok: boolean, detail?: string) => {
    console.log(`${ok ? "✓" : "✕"} ${label}${detail ? `\n  ${detail}` : ""}`);
    passed = passed && ok;
  };
  const unavailable = (label: string, detail = "Not available") => {
    console.log(`- ${label}\n  ${detail}`);
  };
  check("Authentication", Boolean(connection?.userId));
  check("Project connection", Boolean(connection?.projectId));
  try {
    if (!connection?.userId || !connection.projectId || !connection.apiKey) throw new Error("Run /connect first.");
    await verifyApiKeyRelationship(api, { userId: connection.userId, projectId: connection.projectId, apiKey: connection.apiKey, sessionId: session?.sessionId });
    check("API connection", true);
    check("API key", true);
    const integration = inspectIntegration(project);
    check("SDK integration", integration.sdkInstalled && integration.initialized, "SDK configuration could not be detected.");
    if (connection.avatarId) {
      await verifyAvatar(api, { userId: connection.userId, projectId: connection.projectId, apiKey: connection.apiKey, avatarId: connection.avatarId, sessionId: session?.sessionId });
      check("Avatar configuration", true);
    } else check("Avatar configuration", false, "No avatar is configured.");
    try {
      const projectInfo = await fetchProjectInfo(api, connection.projectId, {
        apiKey: connection.apiKey,
        userId: connection.userId,
        sessionId: session?.sessionId,
      });
      const sdkStatus = projectInfo.connectionStatus?.trim().toLowerCase();
      if (sdkStatus === "connected") check("SDK connection", true);
      else if (sdkStatus === "inactive") check("SDK connection", false, "SDK connection is inactive.");
      else if (sdkStatus === "not_detected") check("SDK connection", false, "SDK has not communicated with the backend.");
      else unavailable("SDK connection");
      const domain = projectInfo.website ?? connection.website;
      if (!domain) unavailable("Domain connection");
      else check("Domain connection", true, domain);
      const domainState = domainVerificationState(projectInfo.domainStatus);
      if (domainState === "verified") check("Domain verification", true);
      else if (domainState === "failed") check("Domain verification", false, "Domain verification failed.");
      else if (domainState === "not_verified") check("Domain verification", false, "Domain is not verified.");
      else unavailable("Domain verification");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        unavailable("Domain connection", "The requested project/domain was not found.");
        unavailable("Domain verification", "The requested project/domain was not found.");
      } else if (error instanceof ApiError && error.status === 401) {
        unavailable("Domain connection", "You are not logged in. Run /login.");
        unavailable("Domain verification", "You are not logged in. Run /login.");
      } else if (error instanceof ApiError && error.status === 403) {
        unavailable("Domain connection", "You do not have access to this project.");
        unavailable("Domain verification", "You do not have access to this project.");
      } else {
        unavailable("Domain connection");
        unavailable("Domain verification");
      }
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      console.log("You are not logged in. Run /login.");
    } else if (error instanceof ApiError && error.status === 403) {
      console.log("You do not have access to this project.");
    } else if (error instanceof ApiError && error.status === 404) {
      console.log("The requested project/domain was not found.");
    } else {
      check("Backend verification", false, error instanceof Error ? error.message : "Verification failed.");
    }
  }
  console.log(`\nIntegration test ${passed ? "completed successfully." : "failed; fix the checks above and try again."}`);
}
