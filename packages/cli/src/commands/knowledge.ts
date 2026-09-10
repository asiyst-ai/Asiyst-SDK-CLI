import { ApiError } from "../api/errors.js";
import { openAuthenticatedWebPage } from "../browser/onboarding.js";
import { buildKnowledgeUrl } from "../browser/urls.js";
import { loadConnection } from "../config/credentials.js";
import { createApiClient } from "./shared.js";
import { requireAuthenticated } from "./authenticated.js";

export async function knowledgeCommand(cwd = process.cwd(), args: string[] = []): Promise<void> {
  if (!(await requireAuthenticated())) return;
  const connection = await loadConnection(cwd);
  if (!connection?.projectId) {
    console.log("No project is connected. Run /connect.");
    return;
  }
  if (args[0] === "sync") {
    console.log("Knowledge synchronization is managed by Asiyst and no sync endpoint is exposed by the current CLI API.");
    console.log("Open Knowledge to start or monitor a real backend synchronization.");
  } else {
    console.log("\nKnowledge Sources");
    console.log("Knowledge source details are available from the connected Asiyst project.");
  }
  try {
    const targetUrl = buildKnowledgeUrl(connection.projectId);
    if (await openAuthenticatedWebPage(createApiClient(), targetUrl, undefined, "Knowledge Base")) console.log("✓ Knowledge page opened.");
    else console.log("Unable to open the authenticated Knowledge page.");
  } catch (error) {
    console.log(error instanceof ApiError ? error.message : "Unable to open the Knowledge page.");
  }
}
