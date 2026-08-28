import { isTrusted, revokeTrust, trustFolder } from "../config/trust.js";
import { confirm } from "./shared.js";
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
export async function trustCommand(cwd = process.cwd()): Promise<void> { await ensureTrusted(cwd); }
export function revokeTrustCommand(cwd = process.cwd()): void { revokeTrust(cwd); console.log("✓ Folder trust revoked."); }
