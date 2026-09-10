import { ApiClient } from "../api/client.js";
import { loadConnection } from "../config/credentials.js";
import { createApiClient } from "./shared.js";
import { validateCommand } from "./validate.js";
import { requireAuthenticated } from "./authenticated.js";

export async function publishCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  if (!(await requireAuthenticated())) return;
  console.log("Preparing publication...");
  const connection = await loadConnection(cwd);
  if (!connection?.projectId || !connection.userId || !connection.apiKey || !connection.avatarId || !(await validateCommand(cwd, api))) return;
  const result = await api.request<Record<string, unknown>>(`/cli/projects/${encodeURIComponent(connection.projectId)}/publish`, {
    method: "POST",
    body: JSON.stringify({ userId: connection.userId, projectId: connection.projectId, avatarId: connection.avatarId }),
  });
  console.log("✓ Avatar/configuration published successfully.");
  if (typeof result.version === "string") console.log(`Published version: ${result.version}`);
  if (typeof result.status === "string") console.log(`Status: ${result.status}`);
}
