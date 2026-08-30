import { homeStatus } from "../ui/output.js";
import { selectOption } from "../ui/selector.js";
import { readCurrentVersion } from "../config/version.js";
import { connectCommand } from "./connect.js";
import { disconnectCommand } from "./disconnect.js";
import { statusCommand } from "./status.js";

export function interactiveHelp(): void {
  console.log(`
Asiyst CLI

Usage: asiyst [command]

Commands
  connect       Connect this project to Asiyst
  status        Show connection status
  health        Check Asiyst API connectivity
  disconnect    Remove local connection information
  help          Show available commands
  version       Show CLI version

Also available
  trust         Trust this project folder
  revoke-trust  Revoke folder trust
  doctor        Run diagnostics
  update        Check for CLI updates

Examples
  asiyst connect
  asiyst status
  asiyst disconnect
`);
}

export async function interactiveHome(): Promise<void> {
  homeStatus();
  for (;;) {
    const result = await selectOption("What would you like to do?", [
      { label: "Connect", value: "connect" },
      { label: "Status", value: "status" },
      { label: "Help", value: "help" },
      { label: "Exit", value: "exit" },
    ]);
    if (result.type !== "selected" || result.value === "exit") {
      break;
    }
    if (result.value === "connect") await connectCommand();
    else if (result.value === "status") await statusCommand();
    else if (result.value === "help") interactiveHelp();
    else if (result.value === "version") console.log(readCurrentVersion());
  }
}
