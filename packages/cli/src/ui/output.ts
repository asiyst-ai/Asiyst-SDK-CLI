import type { ProjectDetection, VerificationResult } from "../types.js";

export const ok = (label: string, detail = "") => console.log(`✓ ${label}${detail ? ` (${detail})` : ""}`);
export const fail = (label: string, detail = "") => console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
export function banner(): void {
  console.log("\n╭────────────────────────────────────╮\n│              ASIIYST               │\n│       AI Assistant Platform        │\n╰────────────────────────────────────╯\n");
}
export function projectChecks(project: ProjectDetection): void {
  project.packageJson ? ok("Project detected") : fail("Project not detected", "package.json is missing");
  process.version ? ok("Node.js detected", process.version) : fail("Node.js not detected");
  ok("npm detected", "use npm to install dependencies");
  ok("Framework detected", project.framework);
  project.sdkVersion ? ok("@asiyst/sdk detected", project.sdkVersion) : fail("@asiyst/sdk is not installed", "npm install @asiyst/sdk");
}
export function printVerification(results: VerificationResult[]): boolean {
  console.log("\nAsiyst Installation Verification\n");
  for (const result of results) result.ok ? ok(result.name, result.detail) : fail(result.name, result.detail);
  const success = results.length > 0 && results.every((result) => result.ok);
  if (success) console.log("\n────────────────────────────\n\nASIYST IS READY ✓");
  return success;
}
