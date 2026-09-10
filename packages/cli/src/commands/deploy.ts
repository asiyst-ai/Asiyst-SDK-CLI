import { ApiClient } from "../api/client.js";
import { loadConnection } from "../config/credentials.js";
import { createApiClient } from "./shared.js";
import { validateCommand } from "./validate.js";
import { requireAuthenticated } from "./authenticated.js";

export async function deployCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  if (!(await requireAuthenticated())) return;
  console.log("Preparing deployment...");
  const connection = await loadConnection(cwd);
  if (!connection?.projectId || !connection.userId || !connection.apiKey || !(await validateCommand(cwd, api))) return;
  console.log("\nDeploying Asiyst configuration...");
  const result = await api.request<Record<string, unknown>>(`/cli/projects/${encodeURIComponent(connection.projectId)}/deploy`, {
    method: "POST",
    body: JSON.stringify({ userId: connection.userId, projectId: connection.projectId }),
  });
  console.log("✓ Asiyst configuration deployed successfully.");
  if (typeof result.deploymentId === "string") console.log(`Deployment: ${result.deploymentId}`);
}
