import type { ProjectDetection } from "../types.js";
import { muted, section, success, symbols, title, warning } from "./format.js";

export const ok = (label: string, detail = "") => console.log(`${success(symbols.success)} ${label}${detail ? ` (${detail})` : ""}`);
export const fail = (label: string, detail = "") => console.log(`${symbols.error} ${label}${detail ? `: ${detail}` : ""}`);

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
    : console.log(`${muted(symbols.disconnected)} @asiyst/sdk not installed. Install it with your package manager.`);
}

export function printProjectSummary(project: ProjectDetection, connected: boolean, projectName?: string, website?: string): void {
  console.log(title("Asiyst CLI"));
  console.log();
  console.log(section("Project"));
  console.log(`  ${projectName || (typeof project.packageJson?.name === "string" ? project.packageJson.name : project.cwd)}`);
  if (website) console.log(`  ${muted(website)}`);
  const marker = connected ? success(symbols.connected) : muted(symbols.disconnected);
  console.log(`  ${marker} ${connected ? "Connected" : "Not connected"}`);
  console.log();
  console.log(section("Environment"));
  console.log(`  ${project.framework} · ${project.language} · ${project.packageManager}`);
}

export function homeStatus(project?: ProjectDetection, connected = false): void {
  if (!project) {
    console.log(`\n${title("Asiyst CLI")}\n`);
    return;
  }
  printProjectSummary(project, connected);
  console.log();
  console.log(connected
    ? "Manage your connected project."
    : `${warning(symbols.warning)} Connect your project to Asiyst to view stats.`);
  console.log();
}
