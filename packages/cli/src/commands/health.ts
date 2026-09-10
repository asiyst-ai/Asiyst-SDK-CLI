import { ApiClient } from "../api/client.js";
import { verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { readProjectMetadata } from "../config/project.js";
import { fail, ok } from "../ui/output.js";
import { printHeader, success, symbols, warning } from "../ui/format.js";
import { createApiClient } from "./shared.js";

export async function healthCommand(api: ApiClient = createApiClient(), cwd = process.cwd()): Promise<void> {
  printHeader("Asiyst Health Check");
  const project = detectProject(cwd);
  let healthy = true;
  ok("Project detected", project.framework);
  if (project.sdkVersion) ok("SDK installed", project.sdkVersion);
  else {
    fail("SDK installed", "Run the avatar import command to install it");
    healthy = false;
  }
  try {
    await api.health();
    ok("Asiyst API reachable");
  } catch {
    fail("Asiyst API reachable", "Unable to reach Asiyst API");
    console.log(`\nHealth: ${warning(symbols.warning)} Action required`);
    return;
  }
  const stored = await loadConnection(cwd);
  const session = await loadOnboardingSession();
  if (!stored?.apiKey || !stored.userId || !stored.projectId) {
    console.log(`\nHealth: ${warning(symbols.warning)} Action required`);
    console.log("Run `asiyst connect` to connect this project.");
    return;
  }
  ok("Authentication valid");
  try {
    await verifyApiKeyRelationship(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      sessionId: session?.sessionId,
    });
    ok("Project authorized");
    const metadata = readProjectMetadata(cwd);
    if (metadata?.avatarId) {
      await verifyAvatar(api, {
        userId: stored.userId,
        projectId: stored.projectId,
        apiKey: stored.apiKey,
        avatarId: metadata.avatarId,
        sessionId: session?.sessionId,
      });
      ok("Avatar verified", metadata.avatarName ?? metadata.avatarId);
    }
    else {
      fail("Avatar", "No imported avatar is recorded for this project");
      healthy = false;
    }
    if (metadata?.projectId === stored.projectId && metadata.publicKey) ok("Local configuration", "Project and public key present");
    else {
      fail("Local configuration", "Project metadata is incomplete");
      healthy = false;
    }
    if (project.sdkVersion && metadata?.avatarId) ok("Website integration", "SDK and avatar are configured");
    else {
      fail("Website integration", "Run `asiyst avatar import`");
      healthy = false;
    }
    console.log(`\nHealth: ${healthy ? `${success(symbols.connected)} Healthy` : `${warning(symbols.warning)} Action required`}`);
  } catch {
    fail("Project authorization", "Run `asiyst connect` to reconnect");
    console.log(`\nHealth: ${warning(symbols.warning)} Action required`);
  }
}
