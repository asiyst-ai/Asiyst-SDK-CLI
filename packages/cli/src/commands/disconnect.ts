import { clearConnection } from "../config/credentials.js";
import { clearProjectMetadata } from "../config/project.js";
import { confirm } from "./shared.js";

export async function disconnectCommand(cwd = process.cwd()): Promise<void> {
  if (!(await confirm("Disconnect this project?"))) {
    console.log("Disconnect cancelled.");
    return;
  }
  await clearConnection(cwd);
  clearProjectMetadata(cwd);
  console.log("✓ Local connection information removed.");
  console.log("The cloud project and API key were not changed.");
}
