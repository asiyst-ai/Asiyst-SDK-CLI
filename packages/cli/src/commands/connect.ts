import { ApiClient } from "../api/client.js";
import { verifyApiKeyRelationship, verifyProject } from "../api/verification.js";
import { fetchDomainVerificationStatus, fetchProjectInfo, setupSdkConfiguration, type DomainVerificationStatus, type SdkSetupResult } from "../api/projects.js";
import { ApiError, friendlyApiMessage } from "../api/errors.js";
import { VERIFY_KEY_URL, isDebugEnabled } from "../config/api.js";
import { isValidApiKey, isValidProjectId, parseProjectIdArgument } from "../config/ids.js";
import { loadConnection, saveConnection } from "../config/credentials.js";
import { openAuthenticatedWebPage } from "../browser/onboarding.js";
import {
  buildProjectNewUrl,
  buildDomainVerificationUrl,
  buildApiKeysUrl,
  buildSdkInstallUrl,
  buildSdkDashboardUrl,
} from "../browser/urls.js";
import { writeProjectMetadata } from "../config/project.js";
import { detectProject } from "../detection/project.js";
import { applyIntegration, installSdk, inspectIntegration, planIntegration } from "../integration/writer.js";
import { ok, projectChecks } from "../ui/output.js";
import { selectOption } from "../ui/selector.js";
import { readInput, readSecret } from "../ui/secret.js";
import { printHeader } from "../ui/format.js";
import { ensureTrusted } from "./trust.js";
import { createApiClient } from "./shared.js";
import { requireAuthenticatedSession } from "./authenticated.js";
import type { OnboardingSession } from "../types.js";

async function retryOrCancel(message: string): Promise<boolean> {
  console.log(message);
  const result = await selectOption("Options:", [
    { label: "Retry", value: true },
    { label: "Cancel", value: false },
  ]);
  return result.type === "selected" && result.value;
}

const DOMAIN_STATUS_POLL_INTERVAL_MS = 1500;
const DOMAIN_STATUS_TIMEOUT_MS = 2 * 60_000;
function domainStatusFailure(status: DomainVerificationStatus): string {
  const detail = [status.errorCode, status.message].filter(Boolean).join(": ");
  return detail ? `✗ Domain verification failed. ${detail}` : "✗ Domain verification failed.";
}

async function waitForDomainVerification(
  api: ApiClient,
  projectId: string,
  sessionId: string,
): Promise<DomainVerificationStatus | null | undefined> {
  const deadline = Date.now() + DOMAIN_STATUS_TIMEOUT_MS;
  let pendingMessageShown = false;
  for (;;) {
    const status = await fetchDomainVerificationStatus(api, projectId, sessionId);
    if (status.projectId !== projectId) {
      throw new ApiError("Asiyst returned a different project for domain verification.", 409, "PROJECT_MISMATCH");
    }
    if (status.verified && status.status === "verified") return status;
    if (status.status === "failed" || status.status === "expired") {
      console.log(domainStatusFailure(status));
      if (status.status === "expired") {
        console.log("The domain verification challenge expired.");
      }
      const retry = await selectOption("What would you like to do?", [
        { label: "Verify Again", value: true },
        { label: "Cancel", value: false },
      ]);
      return retry.type === "selected" && retry.value ? undefined : null;
    }
    if (!pendingMessageShown) {
      console.log("Complete domain verification in your browser. Waiting for verification...");
      pendingMessageShown = true;
    }
    if (Date.now() >= deadline) {
      console.log("✗ Domain verification timed out.");
      const retry = await selectOption("What would you like to do?", [
        { label: "Check Again", value: true },
        { label: "Cancel", value: false },
      ]);
      return retry.type === "selected" && retry.value ? undefined : null;
    }
    await new Promise((resolve) => setTimeout(resolve, DOMAIN_STATUS_POLL_INTERVAL_MS));
  }
}

function printApiFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "HANDOFF_FAILED") {
      return friendlyApiMessage(error);
    }
    if (error.status === 401 && error.code === "SESSION_EXPIRED") {
      return "✗ Asiyst CLI session expired or was rejected.\n  Run /login, then retry /connect.";
    }
    if (error.status !== undefined && error.status < 500 && error.code !== "INVALID_API_KEY" && error.code !== "API_KEY_REVOKED") {
      return `✗ ${error.message}`;
    }
    return friendlyApiMessage(error, error.code === "NOT_FOUND" ? VERIFY_KEY_URL : undefined);
  }
  if (isDebugEnabled() && error instanceof Error) return `✗ ${error.message}`;
  return "✗ Unable to reach Asiyst API.";
}

async function promptForProjectId(): Promise<string | undefined> {
  for (;;) {
    const value = await readInput("Enter your Project ID: ");
    if (value === undefined) {
      console.log("Connection cancelled.");
      return undefined;
    }

    const trimmed = value.trim();
    if (!isValidProjectId(trimmed)) {
      console.log("Invalid Project ID. It must be exactly 24 characters. Try again.");
      continue;
    }
    return trimmed;
  }
}

async function openProjectCreation(api: ApiClient, session: OnboardingSession): Promise<boolean> {
  for (;;) {
    try {
      const targetUrl = buildProjectNewUrl();
      if (await openAuthenticatedWebPage(api, targetUrl, session, "Project Setup")) {
        console.log("✓ Project setup opened.");
        return true;
      }
      console.log("✗ Unable to open the authenticated project setup page.");
    } catch (error) {
      if (error instanceof ApiError && error.code === "SESSION_EXPIRED") {
        console.log("✗ Project Setup could not be opened in the browser.");
        console.log("  The CLI session is still authenticated. Retry the browser handoff or continue with Project ID input.");
      } else {
        console.log(printApiFailure(error));
      }
    }

    const retry = await selectOption("Project setup could not be opened. What would you like to do?", [
      { label: "Retry", value: "retry" as const },
      { label: "Continue with Project ID input", value: "continue" as const },
      { label: "Cancel", value: "cancel" as const },
    ]);
    if (retry.type !== "selected" || retry.value === "cancel") return false;
    if (retry.value === "continue") return true;
  }
}

function projectVerificationMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === "SESSION_EXPIRED") {
      return "✗ Your Asiyst login session has expired. Run /login, then try /connect again.";
    }
    if (error.status === 403 || error.code === "FORBIDDEN") {
      return "✗ This account is authenticated but does not have access to that project. Check the Project ID or choose Create a new project.";
    }
    if (error.status === 404 || error.code === "PROJECT_NOT_FOUND" || error.code === "NOT_FOUND") {
      return "✗ Project ID was not found for this account. Check the ID and try again.";
    }
  }
  return printApiFailure(error);
}

export async function connectCommand(cwd = process.cwd(), api = createApiClient(), cliProjectId?: string, _cliAvatarId?: string): Promise<void> {
  printHeader("Connect project", cwd);
  if (!(await ensureTrusted(cwd))) return;

  // STEP 0 — Detect project
  const project = detectProject(cwd);
  projectChecks(project);
  if (project.framework === "Unknown") {
    console.log("No supported framework was detected in this folder.");
  }

  const currentSession = await requireAuthenticatedSession();
  if (!currentSession) {
    return;
  }

  const currentConnection = await loadConnection(cwd);
  if (currentConnection?.userId && currentConnection.projectId && currentConnection.apiKey) {
    try {
      await verifyApiKeyRelationship(api, {
        userId: currentConnection.userId,
        projectId: currentConnection.projectId,
        apiKey: currentConnection.apiKey,
        sessionId: currentSession.sessionId,
      });
      console.log("✓ Asiyst is already connected.");
      return;
    } catch {
      // A stale or revoked connection must go through the normal connection flow.
    }
  }

  const shouldConnect = await selectOption("Connect this project to Asiyst?", [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ]);
  if (shouldConnect.type !== "selected" || !shouldConnect.value) {
    console.log("Connection cancelled.");
    return;
  }

  const existingSession = currentSession;
  let userId = existingSession.userId;

  // STEP 1 — Authenticated Account
  console.log("\nStep 1 — Authenticated Account");
  ok("Account authenticated", existingSession.accountEmail ?? existingSession.userId ?? "authenticated");

  // STEP 2 — Project Setup
  console.log("\nStep 2 — Project Setup");
  const projectIdArg = cliProjectId ?? parseProjectIdArgument(process.argv.slice(2));
  if (projectIdArg === "") {
    console.log("Project ID is required. Use: asiyst connect --project-id <PROJECT_ID>");
    return;
  }
  let projectId = typeof projectIdArg === "string" ? projectIdArg.trim() : "";
  if (!projectId) {
    const projectChoice = await selectOption("Select a project setup option:", [
      { label: "I already created a project", value: "existing" as const },
      { label: "Create a new project", value: "new" as const },
    ]);
    if (projectChoice.type !== "selected") {
      console.log("Connection cancelled.");
      return;
    }
    if (!(await openProjectCreation(api, existingSession))) {
      return;
    }
    projectId = (await promptForProjectId()) || "";
    if (!projectId) {
      console.log("Project ID is required. Use: asiyst connect --project-id <PROJECT_ID>");
      return;
    }
  } else if (!isValidProjectId(projectId)) {
    console.log("Invalid Project ID. It must be exactly 24 characters.");
    return;
  }

  let verifiedProject;
  for (;;) {
    try {
      verifiedProject = await verifyProject(api, undefined, projectId, existingSession.sessionId);
      if (verifiedProject.userId && !userId) {
        userId = verifiedProject.userId;
      }
      ok("Project verified.");
      break;
    } catch (error) {
      console.log(projectVerificationMessage(error));
      if (error instanceof ApiError && (error.status === 401 || error.code === "SESSION_EXPIRED")) {
        return;
      }
      if (!(await retryOrCancel("Enter a different Project ID or cancel."))) {
        return;
      }
      projectId = (await promptForProjectId()) || "";
      if (!projectId) {
        console.log("Project ID is required. Use: asiyst connect --project-id <PROJECT_ID>");
        return;
      }
    }
  }

  // STEP 3 — Domain Verification
  console.log("\nStep 3 — Domain Verification");
  for (;;) {
    try {
      const domainUrl = buildDomainVerificationUrl(projectId);
      if (!(await openAuthenticatedWebPage(api, domainUrl, existingSession, "Domain Verification"))) {
        console.log("✗ Unable to open Domain Verification.");
        return;
      }
      const domainStatus = await waitForDomainVerification(api, projectId, existingSession.sessionId);
      if (domainStatus === null) {
        console.log("Connection cancelled.");
        return;
      }
      if (domainStatus) {
        ok("Domain verified.");
        break;
      }
    } catch (error) {
      console.log(printApiFailure(error));
      if (error instanceof ApiError && (
        error.code === "NETWORK"
        || error.code === "TIMEOUT"
        || error.status === 503
      )) {
        if (await retryOrCancel("The verification service could not be reached. Retry?")) {
          continue;
        }
      }
      return;
    }
  }

  // STEP 4 — API Key
  console.log("\nStep 4 — API Key");
  console.log(`Create an API key for project: ${projectId}`);
  console.log("Copy the complete secret key generated by Asiyst; do not copy the key ID or masked value.");

  let apiKey: string | undefined;
  let connected: Awaited<ReturnType<typeof verifyApiKeyRelationship>> | undefined;

  for (;;) {
    console.log("\nAPI key required");
    console.log("Find it in: Asiyst Dashboard -> API Keys");
    const openKeys = await selectOption("Open API Keys in your browser?", [
      { label: "Open API Keys", value: true },
      { label: "Continue", value: false },
    ]);
    if (openKeys.type === "selected" && openKeys.value) {
      try {
        const apiKeysUrl = buildApiKeysUrl();
        if (await openAuthenticatedWebPage(api, apiKeysUrl, existingSession, "API Keys")) {
          console.log("✓ API Keys page opened.");
        } else {
          console.log(`Open this URL manually:\n${apiKeysUrl}`);
        }
      } catch (error) {
        console.log(printApiFailure(error));
        return;
      }
    }
    apiKey = await readSecret("Paste your Asiyst API key: ");
    if (apiKey === undefined) {
      console.log("Connection cancelled.");
      return;
    }
    if (!isValidApiKey(apiKey)) {
      console.log("✗ API key verification failed.");
      console.log("API key format is invalid. Use the complete key copied from Asiyst.");
      const retry = await selectOption("Options:", [
        { label: "Retry", value: true },
        { label: "Cancel", value: false },
      ]);
      if (retry.type === "selected" && retry.value) {
        continue;
      }
      console.log("Connection cancelled.");
      return;
    }
    console.log("→ Verifying API key...");
    try {
      connected = await verifyApiKeyRelationship(api, {
        userId: userId || verifiedProject.userId,
        projectId,
        apiKey,
        sessionId: existingSession.sessionId,
      });
      ok("API key verified.");
      ok("Project verified.");
      ok("Account verified.");
      break;
    } catch (error) {
      console.log("✗ API key verification failed.");
      if (error instanceof ApiError) {
        console.log(error.message);
      } else if (error instanceof Error) {
        console.log(error.message);
      } else {
        console.log("Unable to reach Asiyst API for API-key verification. Check your internet connection and try again.");
      }
      const retry = await selectOption("Options:", [
        { label: "Retry", value: true },
        { label: "Cancel", value: false },
      ]);
      if (retry.type === "selected" && retry.value) {
        continue;
      }
      console.log("Connection cancelled.");
      return;
    }
  }

  if (!connected || !apiKey) {
    console.log("Connection cancelled.");
    return;
  }

  // STEP 5 — SDK Setup
  console.log("\nStep 5 — SDK Setup");
  console.log("→ Checking SDK configuration...");
  let sdkConfiguration: SdkSetupResult;
  for (;;) {
    try {
      sdkConfiguration = await setupSdkConfiguration(api, projectId, existingSession.sessionId);
      console.log(sdkConfiguration.created ? "✓ SDK configuration created." : "✓ Existing SDK configuration found.");
      break;
    } catch (error) {
      console.log(`✗ Unable to configure SDK. ${error instanceof ApiError ? error.message : "Unable to provision SDK configuration."}`);
      if (error instanceof ApiError
        && (error.status === 409 || error.status === 429 || error.status === 500 || error.status === 503
          || error.code === "NETWORK" || error.code === "TIMEOUT")
        && await retryOrCancel("SDK setup failed temporarily. Retry Step 5?")) {
        continue;
      }
      return;
    }
  }
  const sdkPublicKey = sdkConfiguration.publicKey;
  console.log("→ Detecting application entry point...");
  let detected = detectProject(cwd);
  let installationPageOpened = false;
  if (!detected.sdkInstalled) {
    console.log("SDK Setup Required");
    console.log(`Project: ${verifiedProject.projectName ?? projectId}`);
    console.log(`Project ID: ${projectId}`);
    console.log("SDK: @asiyst/sdk");
    console.log("→ Opening SDK Installation");
    try {
      installationPageOpened = await openAuthenticatedWebPage(
        api,
        buildSdkInstallUrl(projectId),
        existingSession,
        "SDK Installation",
      );
      if (installationPageOpened) console.log("✓ SDK installation page opened.");
    } catch (error) {
      console.log(`✗ SDK installation page could not be opened. ${error instanceof ApiError ? error.message : "Open the project installation page manually."}`);
    }
    console.log(`Installing @asiyst/sdk with ${detected.packageManager}...`);
    try {
      await installSdk(detected);
    } catch (error) {
      console.log(`✗ SDK installation failed. ${error instanceof Error ? error.message : "Unable to install @asiyst/sdk."}`);
      return;
    }
    if (!detected.sdkInstalled && !installationPageOpened) {
      console.log("Install @asiyst/sdk in the project, then run /connect again.");
      return;
    }
    detected = detectProject(cwd);
  }
  if (!detected.sdkInstalled) {
    console.log("✗ SDK installation could not be verified after installation.");
    return;
  }
  ok("SDK installed", detected.sdkVersion);
  if (detected.entryPoint) {
    console.log(`✓ Application entry point detected: ${detected.entryPoint}`);
  }
  try {
    const existingIntegration = inspectIntegration(detected);
    if (existingIntegration.initialized) {
      if (existingIntegration.projectId !== projectId) {
        throw new Error(`Existing SDK initialization uses project ${existingIntegration.projectId ?? "an unknown project"}. Update it before connecting this project.`);
      }
      if (existingIntegration.publicKey !== sdkPublicKey) {
        throw new Error("Existing SDK initialization uses a different public SDK key. Update it before connecting this project.");
      }
    } else {
      const sdkPlan = planIntegration(detected, { projectId, publicKey: sdkPublicKey });
      applyIntegration(detected, { projectId, publicKey: sdkPublicKey }, sdkPlan);
    }
  } catch (error) {
    console.log(`✗ SDK initialization could not be configured. ${error instanceof Error ? error.message : "Update the project integration and retry."}`);
    return;
  }
  const initialized = inspectIntegration(detectProject(cwd));
  if (!initialized.initialized || initialized.projectId !== projectId || initialized.publicKey !== sdkPublicKey) {
    console.log("✗ SDK initialization is missing or points to a different project.");
    return;
  }
  ok("SDK configuration verified");
  console.log("→ Opening ASIYST SDK setup...");
  try {
    const browserOpened = await openAuthenticatedWebPage(api, buildSdkDashboardUrl(), existingSession);
    if (!browserOpened) {
      console.log("✗ Unable to open ASIYST SDK setup.");
      return;
    }
    console.log("✓ Browser opened.");
    console.log("\nContinue SDK setup in your browser:");
    console.log(buildSdkDashboardUrl());
    console.log("The browser should now open automatically.");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      console.log("Your Asiyst session has expired.");
      console.log("Run /login, then retry /connect.");
      return;
    }
    console.log("✗ Unable to open ASIYST SDK setup.");
    console.log(error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "The browser handoff failed.");
    return;
  }

  const effectiveUserId = userId || connected.userId || verifiedProject.userId || existingSession.userId || "";
  const publicKey = sdkPublicKey;
  const finalConnection = {
    ...connected,
    projectName: connected.projectName ?? verifiedProject.projectName,
    website: connected.website ?? verifiedProject.website,
    projectId,
    userId: effectiveUserId,
    publicKey,
  };
  await saveConnection(cwd, finalConnection);
  writeProjectMetadata(cwd, finalConnection);
}

export async function initCommand(cwd = process.cwd(), api: ApiClient = createApiClient(), cliProjectId?: string): Promise<void> {
  return connectCommand(cwd, api, cliProjectId);
}
