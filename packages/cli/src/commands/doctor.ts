import { ApiClient } from "../api/client.js";
import { loadConnection } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { ok, fail } from "../ui/output.js";
import { CLI_API_BASE_URL, VERIFY_KEY_URL } from "../config/api.js";
import { readCurrentVersion } from "../config/version.js";
import { createApiClient } from "./shared.js";

export async function doctorCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  ok("CLI version", readCurrentVersion());
  ok("Executable", process.argv[1] || "unknown");
  ok("API base", api.baseUrl || CLI_API_BASE_URL);
  ok("Verify endpoint", VERIFY_KEY_URL);
  ok("System", process.platform);
  ok("Node.js", process.version);
  const project = detectProject(cwd);
  project.packageJson ? ok("Project", cwd) : fail("Project", "package.json is missing");
  project.sdkVersion ? ok("SDK", project.sdkVersion) : fail("SDK", "not installed");
  const stored = await loadConnection(cwd);
  stored ? ok("Local credential", "present") : fail("Local credential", "not connected");
  try {
    await api.health();
    ok("Asiyst API", "health endpoint reachable");
  } catch (error) {
    fail("Asiyst API", error instanceof Error ? error.message : "unreachable");
  }
}
