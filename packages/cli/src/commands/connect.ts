import { ApiClient } from "../api/client.js";
import { verifyApiKey } from "../api/auth.js";
import { ApiError, friendlyApiMessage } from "../api/errors.js";
import { openBrowser } from "../browser/open.js";
import { ASIIYST_WEB_URL, VERIFY_KEY_URL, isDebugEnabled } from "../config/api.js";
import { saveConnection } from "../config/credentials.js";
import { writeProjectMetadata } from "../config/project.js";
import { detectProject } from "../detection/project.js";
import { fail, ok, projectChecks } from "../ui/output.js";
import { selectOption } from "../ui/selector.js";
import { readSecret } from "../ui/secret.js";
import { ensureTrusted } from "./trust.js";
import { createApiClient } from "./shared.js";

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
    return friendlyApiMessage(error, error.code === "NOT_FOUND" ? VERIFY_KEY_URL : undefined);
  }
  if (isDebugEnabled() && error instanceof Error) return `✗ ${error.message}`;
  return "✗ Unable to reach Asiyst API.";
}

export async function connectCommand(cwd = process.cwd(), api = createApiClient()): Promise<void> {
  console.log(`Project folder:\n${cwd}`);
  if (!(await ensureTrusted(cwd))) return;

  const project = detectProject(cwd);
  projectChecks(project);
  if (project.framework === "Unknown") {
    console.log("No supported framework was detected in this folder.");
  }

  const shouldConnect = await selectOption("Connect this project to Asiyst?", [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ]);
  if (shouldConnect.type !== "selected" || !shouldConnect.value) {
    console.log("Connection cancelled.");
    return;
  }

  console.log("Opening Asiyst...");
  if (!(await openBrowser(ASIIYST_WEB_URL))) {
    console.log(`Open this URL manually:\n${ASIIYST_WEB_URL}`);
  }
  console.log("Register or log in, complete onboarding, create or select a project, then create an API key.");

  for (;;) {
    const apiKey = await readSecret("Paste your Asiyst API key: ");
    if (apiKey === undefined) {
      console.log("Connection cancelled.");
      return;
    }
    if (!apiKey) {
      fail("Invalid API key.");
      continue;
    }
    try {
      const connected = await verifyApiKey(api, apiKey);
      ok("API key verified.");
      await saveConnection(cwd, connected);
      writeProjectMetadata(cwd, connected);
      ok("Connected to Asiyst.");
      console.log(`\nProject:\n${connected.projectName || connected.projectId}`);
      if (connected.website) console.log(`\nWebsite:\n${connected.website}`);
      return;
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
}

export async function initCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  return connectCommand(cwd, api);
}
