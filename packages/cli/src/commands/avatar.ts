import { openBrowser } from "../browser/open.js";
import { ASIIYST_WEB_URL, ASIYST_DASHBOARD_URLS } from "../config/api.js";
import { importAvatar } from "../api/projects.js";
import { createImportSession, verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { ApiError } from "../api/errors.js";
import { loadConnection, loadOnboardingSession, saveConnection } from "../config/credentials.js";
import { writeProjectMetadata } from "../config/project.js";
import { isValidAvatarId } from "../config/ids.js";
import { readInput } from "../ui/secret.js";
import { selectOption } from "../ui/selector.js";
import { detectProject } from "../detection/project.js";
import { applyIntegration, installSdk, planIntegration, printDryRun, readIntegrationValues } from "../integration/writer.js";
import { createApiClient } from "./shared.js";

function parseAvatarId(argv: string[]): string | undefined {
  const index = argv.findIndex((value) => value === "--avatar-id");
  if (index >= 0) return argv[index + 1];
  const inline = argv.find((value) => value.startsWith("--avatar-id="));
  return inline?.slice("--avatar-id=".length) || argv.slice(1).find((value) => !value.startsWith("--"));
}

function isDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

async function confirm(message: string): Promise<boolean> {
  const result = await selectOption(message, [
    { label: "Continue", value: true },
    { label: "Cancel", value: false },
  ]);
  return result.type === "selected" && result.value;
}

export async function avatarImportCommand(
  cwd = process.cwd(),
  api = createApiClient(),
  suppliedAvatarId?: string,
): Promise<void> {
  const stored = await loadConnection(cwd);
  if (!stored?.apiKey || !stored.userId || !stored.projectId) {
    console.log("No project is connected. Please run:\nasiyst connect");
    return;
  }
  if (!suppliedAvatarId) {
    console.log("\nAvatar ID required");
    console.log("Find it in: Asiyst Dashboard -> Avatar Studio");
    const open = await selectOption("Open Avatar Studio in your browser?", [
      { label: "Open Avatar Studio", value: true },
      { label: "Continue", value: false },
    ]);
    if (open.type === "selected" && open.value) {
      if (await openBrowser(ASIYST_DASHBOARD_URLS.avatarStudio)) console.log("✓ Avatar Studio opened.");
      else console.log(`Open this URL manually:\n${ASIYST_DASHBOARD_URLS.avatarStudio}`);
    }
    console.log("Complete Avatar Studio onboarding, save the avatar, then return here with the generated Avatar ID.");
  }
  const avatarId = suppliedAvatarId ?? await readInput("Enter your Avatar ID: ");
  if (!avatarId || !isValidAvatarId(avatarId)) {
    console.log("Invalid Avatar ID. It must contain exactly 10 alphanumeric characters.");
    return;
  }
  const project = detectProject(cwd);
  const dryRun = process.argv.includes("--dry-run");
  const detectedProjectId = project.config.projectId;
  if (detectedProjectId && detectedProjectId !== stored.projectId) {
    console.log(`Existing projectId ${detectedProjectId} differs from verified project ${stored.projectId}.`);
    if (!(await confirm("Switch this website to the verified project?"))) return;
  }
  try {
    if (dryRun) {
      const configuredPublicKey = stored.publicKey?.trim();
      if (!configuredPublicKey) {
        console.log("✗ No public SDK key is available for this verified project.");
        console.log("Configure the project's public client key in Asiyst, then run `asiyst connect` again.");
        return;
      }
      const plan = planIntegration(project, {
        projectId: stored.projectId,
        publicKey: configuredPublicKey,
        avatarId: avatarId.trim(),
      });
      printDryRun(plan);
      return;
    }
    const verifiedConnection = await verifyApiKeyRelationship(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      sessionId: (await loadOnboardingSession())?.sessionId,
    });
    await verifyAvatar(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      avatarId,
      sessionId: (await loadOnboardingSession())?.sessionId,
    });
    await createImportSession(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      avatarId,
      sessionId: (await loadOnboardingSession())?.sessionId,
    });
    const shouldImport = await confirm("Import this avatar into this website?");
    if (!shouldImport) {
      console.log("Avatar import cancelled. Your verified connection has been saved.");
      return;
    }
    const result = await importAvatar(api, {
      userId: stored.userId,
      projectId: stored.projectId,
      apiKey: stored.apiKey,
      avatarId,
      sessionId: (await loadOnboardingSession())?.sessionId,
    });
    const publicKey = stored.publicKey ?? verifiedConnection.publicKey ?? result.publicKey;
    if (!publicKey) {
      console.log("✗ The verified project did not return a public SDK key. No files were changed.");
      return;
    }
    const plan = planIntegration(detectProject(cwd), {
      projectId: result.projectId,
      publicKey,
      avatarId: result.avatarId,
    });
    const existing = readIntegrationValues(plan);
    if (existing.projectId && existing.projectId !== stored.projectId) {
      console.log(`✗ Existing integration uses project ${existing.projectId}, but the verified project is ${stored.projectId}.`);
      if (!(await confirm("Replace the existing project configuration?"))) return;
    }
    if (existing.avatarId && existing.avatarId !== avatarId.trim()) {
      console.log(`✗ Existing integration uses avatar ${existing.avatarId}, but the verified avatar is ${avatarId.trim()}.`);
      if (!(await confirm("Replace the existing avatar configuration?"))) return;
    }
    if (!plan.sdkInstalled) {
      console.log(`Installing @asiyst/sdk with ${project.packageManager}...`);
      await installSdk(project);
    }
    const configured = applyIntegration(detectProject(cwd), {
      projectId: result.projectId,
      publicKey,
      avatarId: result.avatarId,
    });
    const next = { ...stored, avatarId: result.avatarId, avatarName: result.avatarName, publicKey };
    await saveConnection(cwd, next);
    writeProjectMetadata(cwd, next);
    console.log("✓ Avatar verified");
    console.log("✓ Project verified");
    console.log("✓ API key verified");
    console.log("✓ SDK installed");
    console.log(`✓ Asiyst integration ${configured.componentAction === "unchanged" ? "already " : ""}configured`);
    console.log(`✓ Avatar ${result.alreadyImported ? "already imported" : "imported"}`);
    console.log(`\nYour Asiyst avatar is ready.`);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "FORBIDDEN") console.log("✗ You do not have permission to import an avatar into this project.");
      else if (error.code === "USER_MISMATCH") console.log("✗ The avatar is not owned by the verified Asiyst user.");
      else if (error.code === "PROJECT_MISMATCH") console.log("✗ The avatar is not assigned to the verified project.");
      else if (error.code === "NOT_FOUND") console.log("✗ Project or avatar was not found.");
      else if (error.code === "CONFLICT" || error.code === "AVATAR_ALREADY_IMPORTED") console.log("✗ This avatar is already imported into the project.");
      else console.log(`✗ ${error.message}`);
      return;
    }
    console.log(`✗ ${error instanceof Error ? error.message : "Unable to import the avatar."}`);
  }
}

export async function avatarCommand(cwd = process.cwd(), argv = process.argv.slice(2)): Promise<void> {
  if (argv[0] === "import") {
    await avatarImportCommand(cwd, createApiClient(), parseAvatarId(argv));
    return;
  }
  if (argv.length === 0) {
    const action = await selectOption("Avatar management", [
      { label: "Import avatar", value: "import" },
      { label: "Open Avatar Studio", value: "studio" },
      { label: "Exit", value: "exit" },
    ]);
    if (action.type !== "selected" || action.value === "exit") return;
    if (action.value === "import") {
      await avatarImportCommand(cwd, createApiClient());
      return;
    }
    if (argv[0] === "open") {
      if (await openBrowser(ASIYST_DASHBOARD_URLS.avatarStudio)) console.log("✓ Avatar Studio opened.");
      else console.log(`Open this URL manually:\n${ASIYST_DASHBOARD_URLS.avatarStudio}`);
      return;
    }
    if (await openBrowser(ASIYST_DASHBOARD_URLS.avatarStudio)) console.log("✓ Avatar Studio opened.");
    else console.log(`Open this URL manually:\n${ASIYST_DASHBOARD_URLS.avatarStudio}`);
    return;
  }
  if (argv[0] === "select") {
    if (await openBrowser(ASIYST_DASHBOARD_URLS.avatarStudio)) console.log("✓ Avatar Studio opened.");
    else console.log(`Open this URL manually:\n${ASIYST_DASHBOARD_URLS.avatarStudio}`);
    return;
  }
  const stored = await loadConnection(cwd);
  if (argv[0] === "list" || argv[0] === "status") {
    if (!stored?.avatarId) {
      console.log("No avatar is configured for this project.");
      return;
    }
    console.log("\nAvatar");
    console.log(`Name: ${stored.avatarName ?? "Configured avatar"}`);
    console.log(`Avatar ID: ${stored.avatarId}`);
    console.log("Status: Configured locally; run /status for backend verification.");
    console.log(`Project: ${stored.projectName ?? stored.projectId ?? "Unknown"}`);
    return;
  }
  if (argv[0] === "disconnect") {
    if (!stored?.avatarId) {
      console.log("No avatar is configured for this project.");
      return;
    }
    if (!(await confirm("Disconnect the configured avatar from this project?"))) {
      console.log("Avatar disconnect cancelled.");
      return;
    }
    const { avatarId: _avatarId, avatarName: _avatarName, ...connection } = stored;
    await saveConnection(cwd, connection);
    writeProjectMetadata(cwd, connection);
    console.log("✓ Local avatar configuration removed.");
    return;
  }
  if (!stored) {
    console.log("Connect your project to Asiyst to view avatar information.");
    const url = ASIIYST_WEB_URL;
    if (await openBrowser(url)) console.log(`Opening ${url}`);
    else console.log(`Open this URL manually:\n${url}`);
    return;
  }
  console.log(`Avatar configuration is managed at ${ASIIYST_WEB_URL}.`);
  if (!(await openBrowser(ASIIYST_WEB_URL))) console.log(`Open this URL manually:\n${ASIIYST_WEB_URL}`);
}
