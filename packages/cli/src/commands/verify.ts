import { ApiClient } from "../api/client.js";
import { detectProject } from "../detection/project.js";
import { printVerification, ok, fail } from "../ui/output.js";
export async function verifyCommand(cwd = process.cwd(), api = new ApiClient()): Promise<void> {
  const project = detectProject(cwd);
  if (!project.packageJson) { fail("Project detected", "package.json is missing"); process.exitCode = 1; return; }
  ok("Project detected");
  if (!project.sdkVersion) { fail("SDK installed", "npm install @asiyst/sdk"); process.exitCode = 1; return; }
  ok("SDK installed", project.sdkVersion);
  if (!project.config.projectId || !project.config.publicKey) { fail("Configuration found", "set ASIIYST_PROJECT_ID and ASIIYST_PUBLIC_KEY"); process.exitCode = 1; return; }
  ok("Configuration found");
  try {
    const results = await api.verify(project.config.projectId, project.config.publicKey, process.env.ASIIYST_DOMAIN);
    if (!printVerification(results)) process.exitCode = 1;
  } catch (error) {
    fail("API reachable", error instanceof Error ? error.message : "verification failed");
    process.exitCode = 1;
  }
}
