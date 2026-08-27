import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { detectProject } from "../detection/project.js";
import { homeStatus } from "../ui/output.js";
import { avatarCommand } from "./avatar.js";
import { dashboardCommand } from "./dashboard.js";
import { doctorCommand } from "./doctor.js";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { logoutCommand } from "./logout.js";
import { revokeTrustCommand, trustCommand } from "./trust.js";

const commands = ["connect", "status", "diagnostics", "dashboard", "avatar", "help", "version", "trust", "revoke-trust", "logout", "exit"];
export function resolveInput(value: string): string {
  const input = value.trim().toLowerCase();
  if (/^(connect|connect my website|connect this website|connect website|init)/.test(input)) return "connect";
  if (/^(status|check status|check .*installation)/.test(input)) return "status";
  if (/diagnos|doctor/.test(input)) return "diagnostics";
  if (/dashboard/.test(input)) return "dashboard";
  if (/avatar|configure my avatar|create avatar/.test(input)) return "avatar";
  if (/^(help|\?)$/.test(input)) return "help";
  if (/^(version|--version)$/.test(input)) return "version";
  return input;
}
export function interactiveHelp(): void {
  console.log("\nASIYST CLI\n\nUsage: asiyst [command]\n\nCore Commands\n  connect       Connect this project to Asiyst\n  status        Show project and connection status\n  diagnostics   Diagnose installation problems\n  dashboard     Open Asiyst dashboard\n  avatar        Manage avatar configuration\n  help          Show available commands\n  version       Show CLI version\n  trust         Trust this project folder\n  revoke-trust  Revoke folder trust\n\nExamples\n  asiyst connect\n  asiyst status\n  asiyst diagnostics\n  asiyst dashboard");
}
export async function interactiveHome(): Promise<void> {
  const project = detectProject();
  homeStatus(project);
  console.log("\n> Type a command or ask anything...\n\nSuggestions: [connect] [status] [diagnostics] [dashboard] [avatar] [help]");
  const readline = createInterface({ input, output, historySize: 50, completer: (line) => [commands.filter((item) => item.startsWith(line)), line] });
  readline.on("SIGINT", () => readline.close());
  for (;;) {
    let value: string;
    try { value = await readline.question("\n> "); } catch { break; }
    const command = resolveInput(value);
    if (command === "exit" || command === "quit" || !command) break;
    if (command === "connect") await initCommand();
    else if (command === "status") await statusCommand();
    else if (command === "diagnostics") await doctorCommand();
    else if (command === "dashboard") await dashboardCommand();
    else if (command === "avatar") await avatarCommand();
    else if (command === "logout") logoutCommand();
    else if (command === "trust") await trustCommand();
    else if (command === "revoke-trust") revokeTrustCommand();
    else if (command === "help") interactiveHelp();
    else if (command === "version") console.log("0.2.0");
    else console.log(`Unknown command: ${value}\nRun \`asiyst help\` for available commands.`);
  }
  readline.close();
}
