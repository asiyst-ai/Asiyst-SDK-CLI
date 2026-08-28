import type { ProjectDetection, VerificationResult } from "../types.js";

export const ok = (label: string, detail = "") => console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`);
export const fail = (label: string, detail = "") => console.log(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);

export function projectChecks(project: ProjectDetection): void {
  project.packageJson
    ? ok("Project detected", typeof project.packageJson.name === "string" ? project.packageJson.name : project.cwd)
    : fail("Project not detected", "package.json is missing");
  ok("Framework detected", project.framework);
  ok("Language detected", project.language);
  ok("Node.js detected", process.version);
  ok("Package manager detected", project.packageManager);
  project.sdkVersion
    ? ok("@asiyst/sdk detected", project.sdkVersion)
    : fail("@asiyst/sdk is not installed", "npm install @asiyst/sdk");
}

export function homeStatus(project: ProjectDetection, connection = "Not connected"): void {
  console.log("\n  PROJECT STATUS");
  console.log(`    Project          ${typeof project.packageJson?.name === "string" ? project.packageJson.name : "Not detected"}`);
  console.log(`    Framework        ${project.framework}`);
  console.log(`    Language         ${project.language}`);
  console.log(`    Node.js          ${process.version}`);
  console.log(`    Package Manager  ${project.packageManager}`);
  console.log(`    @asiyst/sdk      ${project.sdkVersion || "Not installed"}`);
  console.log("\n  ASIYST STATUS");
  console.log(`    Connection       ${connection}`);
  console.log(`    Avatar           Not configured`);
  console.log(`    AI Provider      Not configured`);
  console.log(`    Project ID       ${project.config.projectId || "—"}`);
  if (connection === "Not connected") console.log("\n  Run 'connect' to link this project.");
}

export function printVerification(results: VerificationResult[]): boolean {
  console.log("\n  Asiyst Installation Verification\n");
  for (const result of results) result.ok ? ok(result.name, result.detail) : fail(result.name, result.detail);
  const success = results.length > 0 && results.every((result) => result.ok);
  if (success) console.log("\n  ────────────────────────────\n\n  ASIYST IS READY ✓");
  return success;
}
