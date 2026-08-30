import { verifyInstallation } from "../api/projects.js";
import { loadConnection } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { ok, fail } from "../ui/output.js";
import { createApiClient } from "./shared.js";

function printVerificationSafe(results: { name: string; ok: boolean; detail?: string }[]): boolean {
  console.log("\nAsiyst Installation Verification\n");
  for (const result of results) result.ok ? ok(result.name, result.detail) : fail(result.name, result.detail);
  return results.length > 0 && results.every((result) => result.ok);
}

export async function verifyCommand(cwd = process.cwd()): Promise<void> {
  const project = detectProject(cwd);
  if (!project.packageJson) { fail("Project detected", "package.json is missing"); process.exitCode = 1; return; }
  ok("Project detected");
  const stored = await loadConnection(cwd);
  if (!stored) { fail("Configuration found", "run asiyst connect"); process.exitCode = 1; return; }
  ok("Configuration found");
  try {
    const results = await verifyInstallation(createApiClient(), stored.projectId, stored.publicKey || "", process.env.ASIIYST_DOMAIN);
    if (!printVerificationSafe(results)) process.exitCode = 1;
  } catch (error) {
    fail("API reachable", error instanceof Error ? error.message : "verification failed");
    process.exitCode = 1;
  }
}
