import type { ProjectDetection } from "../types.js";

export const ok = (label: string, detail = "") => console.log(`✓ ${label}${detail ? ` (${detail})` : ""}`);
export const fail = (label: string, detail = "") => console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);

export function projectChecks(project: ProjectDetection): void {
  project.packageJson
    ? ok("Project detected", typeof project.packageJson.name === "string" ? project.packageJson.name : project.cwd)
    : fail("Project not detected", "package.json is missing");
  if (project.framework === "Unknown") fail("Framework detected", "No supported project type was identified.");
  else ok("Framework detected", project.framework);
  ok("Language detected", project.language);
  ok("Node.js detected", process.version);
  ok("Package manager detected", project.packageManager);
  project.sdkVersion
    ? ok("@asiyst/sdk detected", project.sdkVersion)
    : console.log("@asiyst/sdk is not installed. You can connect the project now and install the SDK later.");
}

export function homeStatus(): void {
  console.log("\nConnect your project to Asiyst to view stats.\n");
}
