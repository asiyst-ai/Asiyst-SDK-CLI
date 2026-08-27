import { ApiClient } from "../api/client.js";
import { detectProject } from "../detection/project.js";
import { openBrowser } from "../browser/open.js";
export async function avatarCommand(cwd = process.cwd(), api = new ApiClient()): Promise<void> {
  const project = detectProject(cwd);
  if (!project.config.projectId) {
    console.log("Avatar\n─────────────────────────────\nNo avatar configured.\n\nCreate your avatar in the Asiyst dashboard.");
    const url = "https://asiyst.com/dashboard/avatar";
    if (await openBrowser(url)) console.log(`Opening ${url}`); else console.log(`Open ${url}`);
    return;
  }
  const info = await api.projectInfo(project.config.projectId);
  console.log(`Avatar\n─────────────────────────────\nStatus        ${info.avatarStatus || "Not configured"}\n\nConfigure your avatar in the Asiyst dashboard.`);
}
