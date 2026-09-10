import { isTrusted, revokeTrust, trustFolder } from "../config/trust.js";
import { confirm } from "./shared.js";
import { printHeader } from "../ui/format.js";
export async function ensureTrusted(cwd = process.cwd()): Promise<boolean> {
  if (isTrusted(cwd)) return true;
  if (!(await confirm(`Trust this project folder?\n\n${cwd}\n\nAsiyst may read project files and modify Asiyst configuration during setup.`))) {
    console.log("Folder not trusted.\nExiting...");
    return false;
  }
  trustFolder(cwd);
  console.log("✓ Folder trusted.");
  return true;
}
export async function trustCommand(cwd = process.cwd()): Promise<void> {
  printHeader("Project Trust", cwd);
  await ensureTrusted(cwd);
}
export function revokeTrustCommand(cwd = process.cwd()): void { revokeTrust(cwd); console.log("✓ Project trust revoked."); }
