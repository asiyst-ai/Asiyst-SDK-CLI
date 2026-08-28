import { checkForUpdate, compareVersions, detectInstallKind, installLatest } from "../update/check.js";
import { readCurrentVersion } from "../config/version.js";
import { confirm } from "./shared.js";

export async function updateCommand(): Promise<void> {
  const result = await checkForUpdate();
  if (!result.latestVersion || compareVersions(result.latestVersion, result.currentVersion) <= 0) {
    console.log(`✓ Asiyst CLI is already up to date.\n\nCurrent version: ${result.currentVersion}`);
    return;
  }
  console.log(`\nUpdate available\n\nCurrent version: ${result.currentVersion}\nNew version: ${result.latestVersion}\n`);
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
    console.log(`✓ Verifying installation\n\nAsiyst CLI successfully updated.\n\nVersion: ${installed}`);
  } catch {
    console.log("✗ Update failed. Your current CLI is unchanged.");
  }
}

export function currentVersion(): string {
  return readCurrentVersion();
}
