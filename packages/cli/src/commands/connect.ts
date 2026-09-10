import { ApiClient } from "../api/client.js";
import { verifyApiKeyRelationship, verifyAvatar, verifyProject } from "../api/verification.js";
import { importAvatar, fetchProjectInfo, verifyInstallation, domainVerificationState } from "../api/projects.js";
import { ApiError, friendlyApiMessage } from "../api/errors.js";
import { VERIFY_KEY_URL, isDebugEnabled } from "../config/api.js";
import { isValidApiKey, isValidAvatarId, isValidProjectId, parseProjectIdArgument } from "../config/ids.js";
import { loadConnection, saveConnection } from "../config/credentials.js";
import { openAuthenticatedWebPage } from "../browser/onboarding.js";
import {
  buildProjectNewUrl,
  buildDomainVerificationUrl,
  buildApiKeysUrl,
  buildAvatarStudioUrl,
  buildKnowledgeUrl,
} from "../browser/urls.js";
import { writeProjectMetadata } from "../config/project.js";
import { detectProject } from "../detection/project.js";
import { applyIntegration, installSdk, planIntegration } from "../integration/writer.js";
import { fail, ok, projectChecks } from "../ui/output.js";
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

function printApiFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status !== undefined && error.status < 500 && error.code !== "INVALID_API_KEY" && error.code !== "API_KEY_REVOKED") {
      return `✗ ${error.message}`;
    }
    return friendlyApiMessage(error, error.code === "NOT_FOUND" ? VERIFY_KEY_URL : undefined);
  }
  if (isDebugEnabled() && error instanceof Error) return `✗ ${error.message}`;
  return "✗ Unable to reach Asiyst API.";
}

async function promptForProjectId(api: ApiClient, session: OnboardingSession): Promise<string | undefined> {
  console.log("\nProject ID required");
  console.log("Find it in: Asiyst Dashboard -> Projects -> Select your project");
  const open = await selectOption("Open Project Creation in your browser?", [
    { label: "Open Project Creation", value: true },
    { label: "Continue", value: false },
  ]);
  if (open.type === "selected" && open.value) {
    try {
      const targetUrl = buildProjectNewUrl();
      if (await openAuthenticatedWebPage(api, targetUrl, session, "Project Setup")) {
        console.log("✓ Project setup opened.");
      } else {
        console.log("Unable to open the authenticated project setup page.");
      }
    } catch (error) {
      console.log(printApiFailure(error));
      return undefined;
    }
  }
  const value = await readInput("Enter your Project ID: ");
  if (value === undefined) {
    console.log("Connection cancelled.");
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    console.log("Project ID is required. Use: asiyst connect --project-id <PROJECT_ID>");
    return undefined;
  }

  return trimmed;
}

function parseAvatarIdArgument(argv: string[]): string | undefined {
  const index = argv.findIndex((value) => value === "--avatar-id" || value === "--avatarId");
  if (index >= 0) return argv[index + 1];
  const inline = argv.find((value) => value.startsWith("--avatar-id=") || value.startsWith("--avatarId="));
  return inline?.slice(inline.indexOf("=") + 1);
}

async function promptForAvatarId(api: ApiClient, projectId: string, session: OnboardingSession): Promise<string | undefined> {
  console.log("\nAvatar ID required");
  console.log("Find it in: Asiyst Dashboard -> Avatar Studio");
  const open = await selectOption("Open Avatar Studio in your browser?", [
    { label: "Open Avatar Studio", value: true },
    { label: "Continue", value: false },
  ]);
  if (open.type === "selected" && open.value) {
    try {
      const avatarUrl = buildAvatarStudioUrl(projectId);
      if (await openAuthenticatedWebPage(api, avatarUrl, session, "Avatar Studio")) {
        console.log("✓ Avatar Studio opened.");
      } else {
        console.log(`Open this URL manually:\n${avatarUrl}`);
      }
    } catch (error) {
      console.log(printApiFailure(error));
      return undefined;
    }
  }
  const value = await readInput("Enter the Avatar ID for this project: ");
  if (value === undefined) {
    console.log("Connection cancelled.");
    return undefined;
  }
  const avatarId = value.trim();
  if (!isValidAvatarId(avatarId)) {
    console.log("Invalid Avatar ID. It must contain exactly 10 alphanumeric characters.");
    return undefined;
  }
  return avatarId;
}

export async function connectCommand(cwd = process.cwd(), api = createApiClient(), cliProjectId?: string, cliAvatarId?: string): Promise<void> {
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
        sessionId: currentSession?.sessionId,
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

  // STEP 2 — Project Creation / Verification
  console.log("\nStep 2 — Project Creation / Verification");
  const projectIdArg = cliProjectId ?? parseProjectIdArgument(process.argv.slice(2));
  if (projectIdArg === "") {
    console.log("Project ID is required. Use: asiyst connect --project-id <PROJECT_ID>");
    return;
  }
  let projectId = typeof projectIdArg === "string" ? projectIdArg.trim() : "";
  if (!projectId) projectId = (await promptForProjectId(api, existingSession)) || "";
  if (!projectId) {
    console.log("Project ID is required. Use: asiyst connect --project-id <PROJECT_ID>");
    return;
  }
  if (!isValidProjectId(projectId)) {
    console.log("Invalid Project ID. It must be exactly 24 characters.");
    return;
  }

  let verifiedProject;
  try {
    verifiedProject = await verifyProject(api, userId, projectId, existingSession.sessionId);
    if (verifiedProject.userId && !userId) {
      userId = verifiedProject.userId;
    }
    ok("Project verified.");
  } catch (error) {
    console.log(printApiFailure(error));
    return;
  }

  // STEP 3 — Domain Verification
  console.log("\nStep 3 — Domain Verification");
  try {
    const domainUrl = buildDomainVerificationUrl(projectId);
    if (await openAuthenticatedWebPage(api, domainUrl, existingSession, "Domain Verification")) {
      console.log("Complete domain verification in your browser, then return here.");
    }
    const ready = await readInput("Press Enter to verify the domain, or Ctrl+C to cancel: ");
    if (ready === undefined) {
      console.log("Connection cancelled.");
      return;
    }
    const projectInfo = await fetchProjectInfo(api, projectId, { sessionId: existingSession.sessionId, userId });
    const domainState = domainVerificationState(projectInfo.domainStatus);
    if (domainState !== "verified") {
      console.log("✗ Domain has not been verified. Complete verification in Asiyst and try again.");
      return;
    }
    if (!projectInfo.publicKey && !verifiedProject.publicKey) {
      console.log("✗ The verified project did not return a public key for domain verification.");
      return;
    }
    ok("Domain verified.");
  } catch (error) {
    console.log(printApiFailure(error));
    return;
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
        const apiKeysUrl = buildApiKeysUrl(projectId);
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
      fail("API key format is invalid. Use the complete key copied from Asiyst.");
      continue;
    }
    try {
      connected = await verifyApiKeyRelationship(api, {
        userId: userId || verifiedProject.userId,
        projectId,
        apiKey,
        sessionId: existingSession.sessionId,
      });
      ok("API key verified.");
      break;
    } catch (error) {
      const message = printApiFailure(error);
      const code = error instanceof ApiError ? error.code : "NETWORK";
      if (code === "INVALID_API_KEY") {
        console.log(message);
        continue;
      }
      if (code === "API_KEY_REVOKED" || code === "FORBIDDEN" || code === "NOT_FOUND" || code === "MALFORMED_RESPONSE") {
        console.log(message);
        return;
      }
      if (!(await retryOrCancel(message))) {
        console.log("Connection cancelled.");
        return;
      }
    }
  }

  if (!connected || !apiKey) {
    console.log("Connection cancelled.");
    return;
  }

  // STEP 5 — SDK Setup
  console.log("\nStep 5 — SDK Setup");
  const detected = detectProject(cwd);
  if (!detected.sdkVersion) {
    console.log(`Installing @asiyst/sdk with ${detected.packageManager}...`);
    await installSdk(detected);
  }
  ok("SDK verified.");

  // STEP 6 — Avatar Configuration
  console.log("\nStep 6 — Avatar Configuration");
  const avatarIdArg = cliAvatarId ?? parseAvatarIdArgument(process.argv.slice(2));
  const avatarId = avatarIdArg?.trim() || await promptForAvatarId(api, projectId, existingSession);
  if (!avatarId) {
    console.log("Avatar ID is required to complete this connection.");
    return;
  }

  let verifiedAvatar: Awaited<ReturnType<typeof verifyAvatar>>;
  let imported: Awaited<ReturnType<typeof importAvatar>>;

  try {
    verifiedAvatar = await verifyAvatar(api, {
      userId: userId || connected.userId,
      projectId,
      apiKey,
      avatarId,
      sessionId: existingSession.sessionId,
    });
    imported = await importAvatar(api, {
      userId: userId || connected.userId,
      projectId,
      apiKey,
      avatarId: verifiedAvatar.avatarId,
      sessionId: existingSession.sessionId,
    });
  } catch (error) {
    console.log(printApiFailure(error));
    return;
  }

  const publicKey = connected.publicKey ?? verifiedProject.publicKey ?? imported.publicKey;
  if (!publicKey) {
    throw new ApiError("The verified project did not return a public SDK key.", 200, "MALFORMED_RESPONSE");
  }

  const detectedAfterSdk = detectProject(cwd);
  const plan = planIntegration(detectedAfterSdk, {
    projectId,
    publicKey,
    avatarId: imported.avatarId,
  });
  applyIntegration(detectedAfterSdk, { projectId, publicKey, avatarId: imported.avatarId }, plan);

  const effectiveUserId = userId || connected.userId || verifiedProject.userId || existingSession.userId || "";
  const finalConnection = {
    ...connected,
    projectName: connected.projectName ?? verifiedProject.projectName,
    website: connected.website ?? verifiedProject.website,
    projectId,
    userId: effectiveUserId,
    avatarId: verifiedAvatar.avatarId,
    avatarName: verifiedAvatar.avatarName,
    publicKey,
  };
  await saveConnection(cwd, finalConnection);
  writeProjectMetadata(cwd, finalConnection);
  ok("Avatar configured and imported.");

  // STEP 7 — Knowledge Base
  console.log("\nStep 7 — Knowledge Base");
  try {
    const knowledgeUrl = buildKnowledgeUrl(projectId, imported.avatarId);
    if (await openAuthenticatedWebPage(api, knowledgeUrl, existingSession, "Knowledge Base")) {
      console.log("Configure and connect Knowledge sources to the selected avatar, then return here.");
    }
  } catch (error) {
    console.log(printApiFailure(error));
    return;
  }
  const knowledgeReady = await readInput("Press Enter to verify Knowledge, or Ctrl+C to cancel: ");
  if (knowledgeReady === undefined) {
    console.log("Connection cancelled.");
    return;
  }
  const finalChecks = await verifyInstallation(api, projectId, publicKey, connected.website ?? verifiedProject.website, existingSession.sessionId);
  if (!finalChecks.every((check) => check.ok)) {
    console.log("✗ Knowledge or final connection verification failed.");
    return;
  }
  console.log("✓ Knowledge connected");
  console.log("✓ Knowledge verified");

  // STEP 8 — Connection Complete & Summary Checklist
  console.log("\nStep 8 — Connection Complete");
  console.log("\nASIYST CONNECTION");
  console.log("------------------");
  console.log("✓ Account connected");
  console.log("✓ Project connected");
  console.log("✓ Domain verified");
  console.log("✓ API key verified");
  console.log("✓ SDK verified");
  console.log(`✓ Avatar verified/imported (${verifiedAvatar.avatarName ?? verifiedAvatar.avatarId})`);
  console.log("✓ Knowledge connected");
  console.log("✓ Knowledge verified");

  console.log("\n✓ Asiyst connected successfully.");

  console.log(`\nProject ID:\n${projectId}`);
  if (connected.projectName) console.log(`\nProject:\n${connected.projectName}`);
  if (connected.website) console.log(`\nWebsite:\n${connected.website}`);
}

export async function initCommand(cwd = process.cwd(), api: ApiClient = createApiClient(), cliProjectId?: string): Promise<void> {
  return connectCommand(cwd, api, cliProjectId);
}
