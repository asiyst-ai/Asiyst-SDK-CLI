import { ApiClient } from "../api/client.js";
import { configWarning, hasConfiguration } from "../config/local.js";
import { detectProject } from "../detection/project.js";
import { ok } from "../ui/output.js";
import { connect, confirm } from "./shared.js";
import { ensureTrusted } from "./trust.js";

export async function initCommand(cwd = process.cwd(), api = new ApiClient()): Promise<void> {
  if (!(await ensureTrusted(cwd))) return;
  const project = detectProject(cwd);
  if (!project.packageJson) throw new Error("No package.json found. Run this command from your website project.");
  console.log(`Detected ${project.framework} project.`);
  if (!project.sdkVersion) {
    console.log("\n@asiyst/sdk is not installed.\nRun: npm install @asiyst/sdk");
    return;
  }
  if (!(await confirm("Connect this project to Asiyst?"))) return;
  const result = await connect(api);
  ok("Asiyst account connected");
  ok("Project connected", result.project?.projectName);
  if (result.project?.projectId) {
    console.log(`\nProject ID: ${result.project.projectId}\nPublic Key: ${result.project.publicKey || project.config.publicKey || "Use the public key from the Asiyst project settings."}`);
  }
  const warning = configWarning(cwd);
  if (warning) console.log(`\nWarning: ${warning}`);
  console.log("\nUse the public SDK API:\n\nimport { Asiyst } from \"@asiyst/sdk\";\n\nawait Asiyst.init({ projectId: \"PROJECT_ID\", publicKey: \"PUBLIC_KEY\" });");
  console.log("\nRun `npx asiyst verify` after starting your website.");
}
