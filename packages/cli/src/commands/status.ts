import { ApiClient } from "../api/client.js";
import { detectProject } from "../detection/project.js";
export async function statusCommand(cwd = process.cwd(), api = new ApiClient()): Promise<void> {
  const project = detectProject(cwd);
  console.log(`Project name: ${typeof project.packageJson?.name === "string" ? project.packageJson.name : "Unknown"}\nSDK version: ${project.sdkVersion || "Not installed"}`);
  if (!project.config.projectId) { console.log("Connection status: Not configured"); return; }
  const info = await api.projectInfo(project.config.projectId);
  for (const [key, value] of Object.entries(info)) if (value !== undefined) console.log(`${key}: ${value}`);
}
