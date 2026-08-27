import type { ProjectDetection, VerificationResult } from "../types.js";

export const ok = (label: string, detail = "") => console.log(`✓ ${label}${detail ? ` (${detail})` : ""}`);
export const fail = (label: string, detail = "") => console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
export function banner(): void {
  console.log(`\n╭──────────────────────────────────────────────╮\n│                                              │\n│       ASIYST                                 │\n│       AI ASSISTANT PLATFORM                  │\n│       v0.2.0                                 │\n│                                              │\n╰──────────────────────────────────────────────╯\n`);
}
export function projectChecks(project: ProjectDetection): void {
  project.packageJson ? ok("Project detected", typeof project.packageJson.name === "string" ? project.packageJson.name : project.cwd) : fail("Project not detected", "package.json is missing");
  ok("Framework detected", project.framework);
  ok("Language detected", project.language);
  ok("Node.js detected", process.version);
  ok("Package manager detected", project.packageManager);
  project.sdkVersion ? ok("@asiyst/sdk detected", project.sdkVersion) : fail("@asiyst/sdk is not installed", "npm install @asiyst/sdk");
}
export function homeStatus(project: ProjectDetection, connection = "Not connected"): void {
  console.log("\nPROJECT STATUS");
  console.log(`  Project          ${typeof project.packageJson?.name === "string" ? project.packageJson.name : "Not detected"}\n  Framework        ${project.framework}\n  Language         ${project.language}\n  Node.js          ${process.version}\n  Package Manager  ${project.packageManager}\n  @asiyst/sdk      ${project.sdkVersion || "Not installed"}`);
  console.log("\nASIYST STATUS");
  console.log(`  Connection       ${connection}\n  Avatar           Not configured\n  AI Provider      Not configured\n  Project ID       ${project.config.projectId || "—"}`);
  if (connection === "Not connected") console.log("\n  Connect website to show stats.");
}
export function printVerification(results: VerificationResult[]): boolean {
  console.log("\nAsiyst Installation Verification\n");
  for (const result of results) result.ok ? ok(result.name, result.detail) : fail(result.name, result.detail);
  const success = results.length > 0 && results.every((result) => result.ok);
  if (success) console.log("\n────────────────────────────\n\nASIYST IS READY ✓");
  return success;
}
