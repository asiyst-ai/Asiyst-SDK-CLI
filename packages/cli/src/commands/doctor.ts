import { ApiClient } from "../api/client.js";
import { detectProject } from "../detection/project.js";
import { ok, fail } from "../ui/output.js";
export async function doctorCommand(cwd = process.cwd(), api = new ApiClient()): Promise<void> {
  const project = detectProject(cwd);
  ok("System", process.platform);
  ok("Node.js", process.version);
  ok("npm", "available through npm");
  project.packageJson ? ok("Project", cwd) : fail("Project", "package.json is missing");
  project.sdkVersion ? ok("SDK", project.sdkVersion) : fail("SDK", "not installed");
  project.config.projectId && project.config.publicKey ? ok("Configuration") : fail("Configuration", "public project values are missing");
  try { await api.projectInfo(project.config.projectId || ""); ok("Asiyst API"); } catch (error) { fail("Asiyst API", error instanceof Error ? error.message : "unreachable"); }
}
