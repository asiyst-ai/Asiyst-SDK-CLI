import { ApiClient } from "../api/client.js";
import { verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { ApiError } from "../api/errors.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { maskSecret, printHeader, section, success, symbols, warning } from "../ui/format.js";
import { printProjectSummary } from "../ui/output.js";
import { createApiClient } from "./shared.js";
import { inspectIntegration } from "../integration/writer.js";
import { domainVerificationState, fetchProjectInfo, verifyInstallation } from "../api/projects.js";
import { requireAuthenticated } from "./authenticated.js";

export async function statusCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  if (!(await requireAuthenticated())) return;
  const session = await loadOnboardingSession();
  const stored = await loadConnection(cwd);
  printHeader("Asiyst Project Status");
  console.log(`CLI Authentication ${session ? `${success(symbols.success)} Logged in` : `${symbols.error} Not logged in`}`);
  if (session?.accountEmail) console.log(`Account ${session.accountEmail}`);
  console.log(`User ${stored?.userId ? `${success(symbols.success)} Verified` : `${symbols.error} Not verified`}`);
  if (!stored?.apiKey) {
    printProjectSummary(detectProject(cwd), false);
    console.log(`Project ${symbols.error} Not connected`);
    console.log(`API Key ${symbols.error} Not verified`);
    console.log(`SDK ${symbols.error} Not connected`);
    console.log(`Avatar ${symbols.error} Not configured`);
    console.log(`Knowledge ${symbols.error} Not connected`);
    return;
  }
  if (!stored.userId || !stored.projectId) {
    console.log(`${symbols.error} Connection is missing a User ID or Project ID. Please run:\nasiyst connect`);
    return;
  }

  try {
    const connected = await verifyApiKeyRelationship(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      sessionId: session?.sessionId,
    });
    if (stored.avatarId) {
      await verifyAvatar(api, {
        userId: stored.userId,
        projectId: stored.projectId,
        apiKey: stored.apiKey,
        avatarId: stored.avatarId,
        sessionId: session?.sessionId,
      });
    }
    const projectId = stored.projectId || connected.projectId;
    const userId = stored.userId || connected.userId;
    let projectInfo;
    try {
      projectInfo = await fetchProjectInfo(api, projectId, {
        apiKey: stored.apiKey,
        userId: stored.userId,
        sessionId: session?.sessionId,
      });
    } catch {
      projectInfo = undefined;
    }
    printProjectSummary(detectProject(cwd), true, connected.projectName, connected.website);
    console.log(`\n${section("Identifiers")}`);
    if (userId) console.log(`  User ID: ${maskSecret(userId)}`);
    console.log(`  Project ID: ${projectId}`);
    console.log(`Project ${success(symbols.success)} Connected`);
    console.log(`API Key ${success(symbols.success)} Verified`);
    const domain = projectInfo?.website ?? connected.website;
    const domainState = domainVerificationState(projectInfo?.domainStatus);
    console.log(`Domain ${domain ? `${success(symbols.success)} ${domain}` : `${symbols.error} Not configured`}`);
    console.log(`Domain Verification ${domainState === "verified"
      ? `${success(symbols.success)} Verified`
      : domainState === "not_verified" || domainState === "failed"
        ? `${symbols.error} Not verified`
        : `${symbols.error} Not available`}`);
    console.log(`\n${section("Integration")}`);
    console.log(`  User: ${success(symbols.success)} Connected`);
    console.log(`  Project: ${success(symbols.success)} ${connected.projectName ?? projectId}`);
    if (stored.avatarId) console.log(`  Avatar: ${success(symbols.success)} ${stored.avatarName ?? stored.avatarId}`);
    else console.log(`  Avatar: ${symbols.error} Not imported`);
    const detection = detectProject(cwd);
    const integration = inspectIntegration(detection);
    const verifiedPublicKey = stored.publicKey ?? connected.publicKey;
    const publicKeyMatches = Boolean(integration.publicKey && verifiedPublicKey && integration.publicKey === verifiedPublicKey);
    let websiteVerified = false;
    if (integration.publicKey && integration.projectId === projectId && publicKeyMatches) {
      const remote = await verifyInstallation(api, projectId, integration.publicKey, process.env.ASIIYST_DOMAIN, session?.sessionId);
      websiteVerified = remote.length > 0 && remote.every((result) => result.ok);
    }
    console.log(`  SDK package: ${integration.sdkInstalled ? `${success(symbols.success)} Installed (${integration.sdkVersion ?? "unknown"})` : `${symbols.error} Not installed`}`);
    console.log(`  SDK initialization: ${integration.initialized ? `${success(symbols.success)} Detected` : `${symbols.error} Not detected`}`);
    console.log(`  SDK project ID: ${integration.projectId === projectId ? `${success(symbols.success)} Matches` : `${symbols.error} Mismatch or missing`}`);
    console.log(`  SDK public key: ${publicKeyMatches ? `${success(symbols.success)} Matches` : `${symbols.error} Mismatch or missing`}`);
    const sdkConnected = integration.sdkInstalled
      && integration.initialized
      && integration.projectId === projectId
      && publicKeyMatches
      && websiteVerified;
    console.log(`  Website: ${sdkConnected ? `${success(symbols.success)} Connected` : `${symbols.error} Not connected`}`);
    console.log(`  SDK: ${sdkConnected ? `${success(symbols.success)} Connected` : `${symbols.error} Not connected`}`);
    console.log(`SDK ${sdkConnected ? `${success(symbols.success)} Connected` : `${symbols.error} Not connected`}`);
    console.log(`Avatar ${stored.avatarId ? `${success(symbols.success)} Configured` : `${symbols.error} Not configured`}`);
    console.log(`Knowledge ${symbols.error} Not connected`);
    if (!sdkConnected) {
      console.log("    Reason: SDK package, initialization, matching project/public key, or website verification is missing.");
    }
    console.log(`\n${success(symbols.success)} Everything looks good.`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "API_KEY_REVOKED") {
      console.log("✗ API key revoked.");
      console.log("Create a new key from:\nhttps://asiyst.com");
      return;
    }
    if (error instanceof ApiError && (error.code === "INVALID_API_KEY" || error.code === "FORBIDDEN")) {
      console.log(error.status === 403
        ? "You do not have access to this project."
        : "You are not logged in. Run /login.");
      return;
    }
    if (error instanceof ApiError && error.status === 404) {
      console.log("The requested project/domain was not found.");
      return;
    }
    console.log(`${symbols.error} Connection invalid. Run \`asiyst doctor\` for diagnostics.`);
  }
}
