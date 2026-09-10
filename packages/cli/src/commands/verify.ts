import { domainVerificationState, fetchProjectInfo, verifyInstallation } from "../api/projects.js";
import { verifyApiKeyRelationship } from "../api/verification.js";
import { ApiError } from "../api/errors.js";
import { openBrowser } from "../browser/open.js";
import { ASIYST_DASHBOARD_URLS, ASIYST_WEB_URL } from "../config/api.js";
import { isValidPublicIdentifier } from "../config/ids.js";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { ok, fail } from "../ui/output.js";
import { createApiClient } from "./shared.js";
import { inspectIntegration } from "../integration/writer.js";
import { readInput } from "../ui/secret.js";
import { selectOption } from "../ui/selector.js";

function printVerificationSafe(results: { name: string; ok: boolean; detail?: string }[]): boolean {
  console.log("\nASIYST SDK STATUS\n");
  for (const result of results) result.ok ? ok(result.name, result.detail) : fail(result.name, result.detail);
  return results.length > 0 && results.every((result) => result.ok);
}

async function promptForPublicKey(projectId: string): Promise<string | undefined> {
  console.log("\nPublic SDK Key required.");
  console.log("Find it in: Asiyst Dashboard -> SDK Installation");
  const url = `${ASIYST_WEB_URL}/dashboard/projects/${encodeURIComponent(projectId)}/sdk-install`;
  const open = await selectOption("Open SDK Installation in your browser?", [
    { label: "Open SDK Installation", value: true },
    { label: "Continue", value: false },
  ]);
  if (open.type === "selected" && open.value) {
    if (await openBrowser(url)) console.log("✓ SDK Installation page opened.");
    else console.log(`Open this URL manually:\n${url}`);
  }
  const value = await readInput("Enter your Public SDK Key: ");
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!isValidPublicIdentifier(trimmed)) {
    console.log("✕ Public SDK Key is invalid.");
    return undefined;
  }
  return trimmed;
}

export async function verifyCommand(cwd = process.cwd()): Promise<void> {
  const project = detectProject(cwd);
  if (!project.packageJson) { fail("Project detected", "package.json is missing"); process.exitCode = 1; return; }
  ok("Project detected");
  const stored = await loadConnection(cwd);
  const session = await loadOnboardingSession();
  if (!stored?.apiKey || !stored.userId || !stored.projectId) {
    fail("Configuration found", "run asiyst connect");
    process.exitCode = 1;
    return;
  }
  ok("Configuration found");
  try {
    const api = createApiClient();
    const connected = await verifyApiKeyRelationship(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      sessionId: session?.sessionId,
    });
    const projectInfo = await fetchProjectInfo(api, stored.projectId, {
      apiKey: stored.apiKey,
      userId: stored.userId,
      sessionId: session?.sessionId,
    });
    const integration = inspectIntegration(project);
    let publicKey = integration.publicKey ?? stored.publicKey ?? connected.publicKey;
    const results: { name: string; ok: boolean; detail?: string }[] = [
      { name: "User", ok: Boolean(stored.userId), detail: stored.userId ? "Verified" : "Missing" },
      { name: "Project", ok: Boolean(stored.projectId), detail: stored.projectId ? "Verified" : "Missing" },
      { name: "SDK package", ok: integration.sdkInstalled, detail: integration.sdkVersion ?? "Not installed" },
      { name: "SDK initialization", ok: integration.initialized, detail: integration.initialized ? "Detected" : "Not detected" },
    ];
    if (!publicKey) {
      publicKey = await promptForPublicKey(stored.projectId);
      results.push({ name: "Public SDK Key", ok: false, detail: publicKey ? "Entered key is not present in the local SDK initialization." : "Missing" });
    } else {
      const keyMatches = Boolean(integration.publicKey && integration.publicKey === publicKey);
      results.push({
        name: "Public SDK Key",
        ok: isValidPublicIdentifier(publicKey) && keyMatches,
        detail: keyMatches ? "Matches" : "Website Public SDK Key is missing or does not match.",
      });
    }
    if (integration.projectId) {
      results.push({
        name: "Project ID",
        ok: integration.projectId === stored.projectId,
        detail: integration.projectId === stored.projectId ? "Matches" : "Website Project ID does not match the selected Asiyst project.",
      });
    } else {
      results.push({ name: "Project ID", ok: false, detail: "Not detected in SDK initialization." });
    }
    if (publicKey && isValidPublicIdentifier(publicKey) && (!integration.publicKey || integration.publicKey === publicKey)) {
      const remote = await verifyInstallation(api, stored.projectId, publicKey, process.env.ASIIYST_DOMAIN, session?.sessionId);
      results.push(...remote.map((result) => ({ name: result.name, ok: result.ok, detail: result.detail })));
    } else {
      results.push({ name: "Website/SDK activity", ok: false, detail: "Public SDK key or local key match is missing." });
    }
    const domainState = domainVerificationState(projectInfo.domainStatus);
    results.push({
      name: "Domain",
      ok: domainState === "verified",
      detail: domainState === "verified"
        ? projectInfo.website ?? "Verified"
        : domainState === "not_verified" ? "Not verified" : domainState === "failed" ? "Failed" : "Not available",
    });
    const sdkState = projectInfo.connectionStatus?.trim().toLowerCase();
    results.push({
      name: "SDK connection",
      ok: sdkState === "connected",
      detail: sdkState === "connected"
        ? "Connected"
        : sdkState === "inactive" ? "Inactive" : sdkState === "not_detected" ? "Not detected" : "Not available",
    });
    results.push({ name: "SDK Connected", ok: results.every((result) => result.ok), detail: results.every((result) => result.ok) ? "Verified" : "Incomplete verification" });
    if (!printVerificationSafe(results)) process.exitCode = 1;
  } catch (error) {
    fail("API reachable", error instanceof ApiError ? error.message : "verification failed");
    console.log("\n✕ SDK Not Connected");
    process.exitCode = 1;
  }
}
