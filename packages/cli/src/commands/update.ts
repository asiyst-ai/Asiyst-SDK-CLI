import { checkForUpdate, compareVersions, detectInstallKind, installLatest } from "../update/check.js";
import { readCurrentVersion } from "../config/version.js";
import { confirm } from "./shared.js";
import { printHeader, success, symbols, warning } from "../ui/format.js";

export async function updateCommand(): Promise<void> {
  printHeader("Asiyst CLI Update");
  const result = await checkForUpdate();
  if (!result.latestVersion || compareVersions(result.latestVersion, result.currentVersion) <= 0) {
    console.log(`${success(symbols.success)} Latest version\n\nCurrent version: ${result.currentVersion}`);
    return;
  }
  console.log(`${warning(symbols.warning)} Update available\n\nCurrent version: ${result.currentVersion}\nLatest version: ${result.latestVersion}\n`);
  if (!process.stdin.isTTY || !(await confirm(`Update Asiyst CLI from ${result.currentVersion} to ${result.latestVersion}?`))) {
    console.log("Update cancelled.");
    return;
  }
  const kind = detectInstallKind();
  if (kind === "local") {
    console.log("This CLI is installed locally. Update it through its package manager; no project files were changed.");
    return;
  }
  try {
    console.log("\nUpdating Asiyst CLI...\n✓ Downloading and installing");
    const installed = installLatest(result.latestVersion, kind);
    if (!installed || compareVersions(installed, result.latestVersion) !== 0) {
      throw new Error("installed version could not be verified");
    }
    console.log(`${success(symbols.success)} Verifying installation\n\nAsiyst CLI updated from ${result.currentVersion} to ${installed}.\nRestart Asiyst to use the new version.`);
  } catch (error) {
    console.log(`✗ Update failed. Your current CLI is unchanged.\n${error instanceof Error ? error.message : "Installation could not be verified."}`);
  }
}

export function currentVersion(): string {
  return readCurrentVersion();
}
