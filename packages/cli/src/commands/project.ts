import { openBrowser } from "../browser/open.js";
import { fetchProjectInfo } from "../api/projects.js";
import { verifyProject } from "../api/verification.js";
import { ApiClient } from "../api/client.js";
import { ASIYST_DASHBOARD_URLS } from "../config/api.js";
import { isValidProjectId } from "../config/ids.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { createApiClient } from "./shared.js";

export async function projectCommand(cwd = process.cwd(), args: string[] = [], api: ApiClient = createApiClient()): Promise<void> {
  const connection = await loadConnection(cwd);
  if (args[0] === "list" || args[0] === "select") {
    console.log("Project selection is managed in the Asiyst dashboard.");
    const url = ASIYST_DASHBOARD_URLS.projects;
    if (await openBrowser(url)) console.log("✓ Projects page opened.");
    else console.log(`Open this URL manually:\n${url}`);
    return;
  }
  if (args[0] && args[0] !== "current") {
    if (!connection?.userId || !isValidProjectId(args[0])) {
      console.log("A valid connected User ID and Project ID are required.");
      return;
    }
    const session = await loadOnboardingSession();
    await verifyProject(api, connection.userId, args[0], session?.sessionId);
    console.log(`✓ Project verified: ${args[0]}`);
    return;
  }
  if (!connection?.projectId) {
    console.log("No project is connected. Run /connect.");
    return;
  }
  try {
    const session = await loadOnboardingSession();
    const info = await fetchProjectInfo(api, connection.projectId, {
      apiKey: connection.apiKey,
      userId: connection.userId,
      sessionId: session?.sessionId,
    });
    console.log("\nCurrent Project");
    console.log(`Name: ${info.projectName ?? connection.projectName ?? "Unknown"}`);
    console.log(`Project ID: ${connection.projectId}`);
    console.log(`Website: ${info.publicKey ? (connection.website ?? "Configured") : (connection.website ?? "Unknown")}`);
    console.log("Environment: Production");
  } catch {
    console.log("\nCurrent Project");
    console.log(`Name: ${connection.projectName ?? "Unknown"}`);
    console.log(`Project ID: ${connection.projectId}`);
    console.log(`Website: ${connection.website ?? "Unknown"}`);
    console.log(`Environment: ${detectProject(cwd).framework}`);
  }
  const url = `${ASIYST_DASHBOARD_URLS.projects}/${encodeURIComponent(connection.projectId)}`;
  console.log(`\nOpen project: ${url}`);
}
