import { banner, projectChecks } from "./ui/output.js";
import { detectProject } from "./detection/project.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { statusCommand } from "./commands/status.js";
import { verifyCommand } from "./commands/verify.js";
import { doctorCommand } from "./commands/doctor.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

export const CLI_VERSION = "0.2.0";
function help(): void {
  console.log(`Asiyst CLI ${CLI_VERSION}\n\nUsage: asiyst [command]\n\nCommands:\n  init       Connect the current project\n  login      Authenticate in the browser\n  logout     Remove local CLI session information\n  status     Show safe project status\n  verify     Verify the live SDK integration\n  doctor     Diagnose the local project and API\n  dashboard  Open the Asiyst dashboard\n  --help     Show this help\n  --version  Show the CLI version`);
}
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0] || "";
  if (command === "--help" || command === "-h") return help();
  if (command === "--version" || command === "-v") return console.log(CLI_VERSION);
  if (command === "init") return initCommand();
  if (command === "login") return loginCommand();
  if (command === "logout") return logoutCommand();
  if (command === "status") return statusCommand();
  if (command === "verify") return verifyCommand();
  if (command === "doctor") return doctorCommand();
  if (command === "dashboard") return dashboardCommand();
  banner();
  const project = detectProject();
  projectChecks(project);
  if (!process.stdin.isTTY) {
    console.log("\nRun `npx asiyst init` to connect this project, or `npx asiyst --help` for commands.");
    return;
  }
  console.log("\nWhat would you like to do?\n\n1. Connect this project\n2. Verify installation\n3. View project status\n4. Open dashboard\n5. Run diagnostics\n6. Exit\n");
  const readline = createInterface({ input, output });
  const choice = await readline.question("Select an option [1-6]: ");
  readline.close();
  if (choice === "1") return initCommand();
  if (choice === "2") return verifyCommand();
  if (choice === "3") return statusCommand();
  if (choice === "4") return dashboardCommand();
  if (choice === "5") return doctorCommand();
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => { console.error(`\nError: ${error instanceof Error ? error.message : "command failed"}`); process.exitCode = 1; });
}
