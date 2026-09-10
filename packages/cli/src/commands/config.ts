import { clearConnection, loadConnection } from "../config/credentials.js";
import { clearProjectMetadata } from "../config/project.js";
import { detectProject } from "../detection/project.js";
import { readCurrentVersion } from "../config/version.js";
import { confirm } from "./shared.js";

export async function configCommand(cwd = process.cwd(), args: string[] = []): Promise<void> {
  if (args[0] === "reset") {
    if (!(await confirm("Reset this project's local Asiyst configuration?"))) {
      console.log("Configuration reset cancelled.");
      return;
    }
    await clearConnection(cwd);
    clearProjectMetadata(cwd);
    console.log("✓ Local Asiyst configuration removed.");
    return;
  }
  const connection = await loadConnection(cwd);
  const project = detectProject(cwd);
  console.log("\nConfiguration");
  console.log(`User: ${connection?.userId ? "Connected" : "Not configured"}`);
  console.log(`Project: ${connection?.projectName ?? "Not configured"}`);
  console.log(`Project ID: ${connection?.projectId ?? "Not configured"}`);
  console.log("Environment: Production");
  console.log(`CLI Version: ${readCurrentVersion()}`);
  console.log(`SDK Version: ${project.sdkVersion ?? "Not installed"}`);
  console.log(`API Key: ${connection?.apiKey ? "Configured" : "Not configured"}`);
}
