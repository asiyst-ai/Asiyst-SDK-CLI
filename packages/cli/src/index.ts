import { projectChecks } from "./ui/output.js";
import { detectProject } from "./detection/project.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { statusCommand } from "./commands/status.js";
import { verifyCommand } from "./commands/verify.js";
import { doctorCommand } from "./commands/doctor.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { avatarCommand } from "./commands/avatar.js";
import { revokeTrustCommand, trustCommand } from "./commands/trust.js";
import { interactiveHelp, interactiveHome } from "./commands/interactive.js";
import { readCurrentVersion } from "./config/version.js";
import { notifyIfUpdateAvailable } from "./update/check.js";
import { updateCommand } from "./commands/update.js";
import { fileURLToPath } from "node:url";

export const CLI_VERSION = readCurrentVersion();
function help(): void { interactiveHelp(); }
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0] || "";
  if (command !== "update" && !argv.includes("--version") && !argv.includes("-v") && !argv.includes("--help") && !argv.includes("-h")) {
    await notifyIfUpdateAvailable();
  }
  if (command === "--help" || command === "-h") return help();
  if (command === "--version" || command === "-v") return console.log(CLI_VERSION);
  if (command === "init" || command === "connect") return initCommand();
  if (command === "login") return loginCommand();
  if (command === "logout") return logoutCommand();
  if (command === "status") return statusCommand();
  if (command === "verify") return verifyCommand();
  if (command === "doctor") return doctorCommand();
  if (command === "diagnostics") return doctorCommand();
  if (command === "dashboard") return dashboardCommand();
  if (command === "avatar") return avatarCommand();
  if (command === "trust") return trustCommand();
  if (command === "revoke-trust") return revokeTrustCommand();
  if (command === "update") return updateCommand();
  if (command === "help") return help();
  if (command === "version") return console.log(CLI_VERSION);
  if (!process.stdin.isTTY) {
    const project = detectProject();
    projectChecks(project);
    console.log("\nRun `npx @asiyst/cli connect` to connect this project, or `npx @asiyst/cli --help` for commands.");
    return;
  }
  return interactiveHome();
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => { console.error(`\nError: ${error instanceof Error ? error.message : "command failed"}`); process.exitCode = 1; });
}
