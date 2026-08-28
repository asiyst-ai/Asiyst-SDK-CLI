import { ApiClient } from "../api/client.js";
import { detectProject } from "../detection/project.js";
export async function statusCommand(cwd = process.cwd(), api = new ApiClient()): Promise<void> {
  const project = detectProject(cwd);
  console.log(`Project: ${typeof project.packageJson?.name === "string" ? project.packageJson.name : "Unknown"}\nSDK: ${project.sdkVersion || "Not connected"}`);
  if (!project.config.projectId || !project.config.publicKey) {
    console.log("\nProject: Not connected\nSDK: Not connected\nAvatar: Not configured\n\nStatistics:\nConnect your website to show stats.");
    return;
  }
  const info = await api.projectInfo(project.config.projectId);
  console.log(`\nProject: ${info.connectionStatus || "Connected"}\nSDK: ${project.sdkVersion}\nAvatar: ${info.avatarStatus || "Not configured"}`);
  console.log("\nStatistics:");
  console.log(info.lastSdkConnection ? `Last SDK heartbeat: ${info.lastSdkConnection}` : "No SDK heartbeat recorded.");
}
