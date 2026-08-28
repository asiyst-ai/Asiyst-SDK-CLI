import { detectProject } from "../detection/project.js";
import { homeStatus } from "../ui/output.js";
import { selectOption } from "../ui/selector.js";
import { avatarCommand } from "./avatar.js";
import { dashboardCommand } from "./dashboard.js";
import { doctorCommand } from "./doctor.js";
import { initCommand } from "./init.js";
import { logoutCommand } from "./logout.js";
import { statusCommand } from "./status.js";
import { revokeTrustCommand, trustCommand } from "./trust.js";
import { updateCommand } from "./update.js";
import { readCurrentVersion } from "../config/version.js";

export function resolveInput(value: string): string {
  const input = value.trim().toLowerCase();
  if (/^(connect|connect my website|connect this website|connect website|init)/.test(input)) return "connect";
  if (/^(status|check status|check .*installation)/.test(input)) return "status";
  if (/diagnos|doctor/.test(input)) return "diagnostics";
  if (/dashboard/.test(input)) return "dashboard";
  if (/avatar|configure my avatar|create avatar/.test(input)) return "avatar";
  if (/update|upgrade/.test(input)) return "update";
  if (/^(help|\?)$/.test(input)) return "help";
  if (/^(version|--version)$/.test(input)) return "version";
  return input;
}

export function interactiveHelp(): void {
  console.log("\nASIYST CLI\n\nUsage: asiyst [command]\n\nCommands\n  connect       Connect this project to Asiyst\n  status        Show project and Asiyst status\n  diagnostics   Run diagnostics\n  dashboard     Open Asiyst dashboard\n  avatar        Configure avatar\n  update        Check for and install CLI updates\n  help          Show available commands\n  version       Show CLI version\n  trust         Trust this project folder\n  revoke-trust  Revoke folder trust\n  logout        Remove local CLI session information\n\nExamples\n  asiyst connect\n  asiyst status\n  asiyst update");
}

export async function interactiveHome(): Promise<void> {
  homeStatus(detectProject());
  console.log("\nWelcome to Asiyst CLI.\nUse UP/DOWN to select a command, or type a command.\n");
  const suggestions = [
    { label: "Connect this project", value: "connect" },
    { label: "Check project status", value: "status" },
    { label: "Run diagnostics", value: "diagnostics" },
    { label: "Open dashboard", value: "dashboard" },
    { label: "Configure avatar", value: "avatar" },
    { label: "Update CLI", value: "update" },
    { label: "Help", value: "help" },
    { label: "Exit", value: "exit" },
  ];
  for (;;) {
    const result = await selectOption("What would you like to do?", suggestions, "› ");
    if (result.type === "exit") break;
    if (result.type !== "selected") continue;
    const command = resolveInput(result.input || String(result.value));
    if (command === "exit" || command === "quit") {
      const confirmed = await selectOption("Exit Asiyst?", [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ]);
      if (confirmed.type === "selected") {
        if (confirmed.value) break;
      }
      continue;
    }
    if (command === "connect") await initCommand();
    else if (command === "status") await statusCommand();
    else if (command === "diagnostics") await doctorCommand();
    else if (command === "dashboard") await dashboardCommand();
    else if (command === "avatar") await avatarCommand();
    else if (command === "update") await updateCommand();
    else if (command === "logout") logoutCommand();
    else if (command === "trust") await trustCommand();
    else if (command === "revoke-trust") revokeTrustCommand();
    else if (command === "help") interactiveHelp();
    else if (command === "version") console.log(readCurrentVersion());
    else console.log(`I don't recognize that command: ${result.input}\nRun 'asiyst help' for available commands.`);
  }
}
