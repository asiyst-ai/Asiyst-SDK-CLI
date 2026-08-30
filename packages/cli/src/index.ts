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
import { connectCommand } from "./commands/connect.js";
import { disconnectCommand } from "./commands/disconnect.js";
import { healthCommand } from "./commands/health.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const CLI_VERSION = readCurrentVersion();

function help(): void {
  interactiveHelp();
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0] || "";
  if (command !== "update" && !argv.includes("--version") && !argv.includes("-v") && !argv.includes("--help") && !argv.includes("-h")) {
    await notifyIfUpdateAvailable();
  }
  if (command === "--help" || command === "-h") return help();
  if (command === "--version" || command === "-v") return console.log(CLI_VERSION);
  if (command === "init" || command === "connect") return connectCommand();
  if (command === "login") return loginCommand();
  if (command === "logout") return logoutCommand();
  if (command === "disconnect") return disconnectCommand();
  if (command === "status") return statusCommand();
  if (command === "verify") return verifyCommand();
  if (command === "health") return healthCommand();
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
    help();
    return;
  }
  return interactiveHome();
}

import { realpathSync } from "node:fs";

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    const entryPath = realpathSync(fileURLToPath(import.meta.url));
    const execPath = realpathSync(process.argv[1]);
    return entryPath.toLowerCase() === execPath.toLowerCase();
  } catch {
    return true;
  }
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error(`\nError: ${error instanceof Error ? error.message : "command failed"}`);
    process.exitCode = 1;
  });
}

export { initCommand };
