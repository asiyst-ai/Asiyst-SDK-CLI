import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const DASHBOARD_URL = "https://asiyst.com";

export interface InitResult {
  dashboardUrl: string;
  snippetPath: string;
  nextSteps: string[];
}

export function runInit(cwd: string, now = Date.now()): InitResult {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error("No package.json found. Run this command from your website project.");
  }

  const snippetPath = resolve(cwd, "asiyst.snippet.ts");
  if (!existsSync(snippetPath)) {
    writeFileSync(
      snippetPath,
      `import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "YOUR_PROJECT_ID",
  publicKey: "YOUR_PUBLIC_KEY",
});
`,
      "utf8",
    );
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies?: Record<string, string> };
  const installed = Boolean(pkg.dependencies?.["@asiyst/sdk"]);
  const nextSteps = [
    installed ? "@asiyst/sdk is already listed in package.json." : "Run: npm install @asiyst/sdk",
    "Create a project at https://asiyst.com and copy the projectId and publicKey.",
    `Paste credentials into ${snippetPath} (generated ${now}).`,
    "Add data-asiyst attributes to important buttons, links, and forms.",
  ];

  return { dashboardUrl: DASHBOARD_URL, snippetPath, nextSteps };
}
