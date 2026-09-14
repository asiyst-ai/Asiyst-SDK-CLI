import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { ProjectDetection } from "../types.js";
import { resolveApplicationEntryPoint } from "../detection/project.js";

const execFileAsync = promisify(execFile);
const MARKER_START = "// ASIIYST CLI START";
const MARKER_END = "// ASIIYST CLI END";

export interface IntegrationValues {
  projectId: string;
  publicKey: string;
  avatarId?: string;
}

export interface IntegrationPlan {
  framework: string;
  sdkInstalled: boolean;
  sdkVersion?: string;
  componentPath: string;
  entryPath?: string;
  componentAction: "create" | "update" | "unchanged";
  entryAction: "update" | "unchanged" | "unsupported";
  reason?: string;
}

export interface IntegrationResult extends IntegrationPlan {
  installed: boolean;
}

export interface IntegrationStatus {
  sdkInstalled: boolean;
  sdkVersion?: string;
  initialized: boolean;
  projectId?: string;
  publicKey?: string;
  avatarId?: string;
}

function isSdkInstalled(project: ProjectDetection): boolean {
  return project.sdkInstalled ?? Boolean(project.sdkVersion);
}

function componentSource(values: IntegrationValues, extension: "tsx" | "jsx" | "ts" | "js"): string {
  const avatarOption = values.avatarId ? `\n  avatarId: ${JSON.stringify(values.avatarId)},` : "";
  if (extension === "ts" || extension === "js") {
    return `${MARKER_START}
import { Asiyst } from "@asiyst/sdk";

void (async () => {
  await Asiyst.init({
  projectId: ${JSON.stringify(values.projectId)},
  publicKey: ${JSON.stringify(values.publicKey)},
  ${avatarOption ? avatarOption.trim() : ""}
  position: "bottom-right",
  });
  Asiyst.open();
})();
${MARKER_END}
`;
  }
  const importLine = extension === "tsx"
    ? 'import * as React from "react";'
    : 'import React from "react";';
  return `${MARKER_START}
${importLine}
import { Asiyst } from "@asiyst/sdk";

let asiystStarted = false;

export function AsiystAssistant() {
  React.useEffect(() => {
    if (asiystStarted) return;
    asiystStarted = true;
    void (async () => {
      await Asiyst.init({
        projectId: ${JSON.stringify(values.projectId)},
        publicKey: ${JSON.stringify(values.publicKey)},
        ${avatarOption ? avatarOption.trim() : ""}
        position: "bottom-right",
      });
      Asiyst.open();
    })().catch((error) => {
      asiystStarted = false;
      console.error("Asiyst failed to initialize.", error);
    });
  }, []);

  return null;
}
${MARKER_END}
`;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function findFirst(cwd: string, paths: string[]): string | undefined {
  return paths.map((path) => resolve(cwd, path)).find((path) => existsSync(path));
}

function isTypeScript(project: ProjectDetection): boolean {
  return project.language === "TypeScript" || existsSync(resolve(project.cwd, "tsconfig.json"));
}

function pathsFor(project: ProjectDetection): { component: string; entry?: string; extension: "tsx" | "jsx" | "ts" | "js" } {
  if (project.framework === "Vanilla TypeScript" || project.framework === "Vanilla JavaScript") {
    const extension = project.framework === "Vanilla TypeScript" ? "ts" : "js";
    return {
      component: join("src", `asiyst.${extension}`),
      entry: findFirst(project.cwd, [`src/index.${extension}`, `index.${extension}`]),
      extension,
    };
  }
  const extension = isTypeScript(project) ? "tsx" : "jsx";
  const component = join("src", "components", `AsiystAssistant.${extension}`);
  if (project.framework === "Next.js") {
    const appEntry = findFirst(project.cwd, ["src/app/layout.tsx", "src/app/layout.jsx", "app/layout.tsx", "app/layout.jsx"]);
    if (appEntry) return { component, entry: appEntry, extension: appEntry.endsWith(".tsx") ? "tsx" : "jsx" };
    const pagesEntry = findFirst(project.cwd, ["src/pages/_app.tsx", "src/pages/_app.jsx", "pages/_app.tsx", "pages/_app.jsx"]);
    if (pagesEntry) return { component, entry: pagesEntry, extension: pagesEntry.endsWith(".tsx") ? "tsx" : "jsx" };
    return { component, extension };
  }
  const resolved = resolveApplicationEntryPoint(project.cwd, project.framework, project.language);
  const entry = resolved.entryPoint ? resolve(project.cwd, resolved.entryPoint) : undefined;
  return { component, entry, extension: entry?.endsWith(".tsx") || entry?.endsWith(".ts") ? "tsx" : "jsx" };
}

function updateComponent(path: string, source: string, values: IntegrationValues): "create" | "update" | "unchanged" {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source, "utf8");
    return "create";
  }
  const current = read(path);
  const start = current.indexOf(MARKER_START);
  const end = current.indexOf(MARKER_END);
  if (start >= 0 && end >= start) {
    const next = current.slice(0, start) + source.trimEnd() + current.slice(end + MARKER_END.length);
    if (next === current) return "unchanged";
    writeFileSync(path, next, "utf8");
    return "update";
  }
  const replacements: Record<string, string> = {
    projectId: JSON.stringify(values.projectId),
    publicKey: JSON.stringify(values.publicKey),
  };
  if (values.avatarId) replacements.avatarId = JSON.stringify(values.avatarId);
  let next = source;
  for (const [name, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`(${name}\\s*:\\s*)["'\`][^"'\`]+["'\`]`);
    if (!pattern.test(next)) {
      throw new Error(`Existing Asiyst component is not safely updateable: ${path}`);
    }
    next = next.replace(pattern, `$1${value}`);
  }
  if (next === source) return "unchanged";
  writeFileSync(path, next, "utf8");
  return "update";
}

function updateEntry(path: string, componentPath: string): "update" | "unchanged" {
  const current = read(path);
  const importPath = relative(dirname(path), resolve(componentPath))
    .replace(/\\/g, "/")
    .replace(/\.(tsx|jsx)$/, "")
    .replace(/^\.\//, "");
  const importLine = componentPath.endsWith(".ts") || componentPath.endsWith(".js")
    ? `import "./${importPath}";`
    : `import { AsiystAssistant } from "./${importPath}";`;
  const hasImport = current.includes("AsiystAssistant");
  const nextImport = hasImport ? current : `${importLine}\n${current}`;
  const componentPattern = /<AsiystAssistant\s*\/>/;
  let next = componentPattern.test(nextImport) ? nextImport : nextImport;
  if (!componentPattern.test(nextImport)) {
    if (/\{children\}/.test(nextImport)) {
      next = nextImport.replace(/\{children\}/, "<AsiystAssistant />\n        {children}");
    } else if (/<App\s*\/>/.test(nextImport)) {
      next = nextImport.replace(/<App\s*\/>/, "<><AsiystAssistant /><App /></>");
    } else if (/<Component\s+\{\.\.\.pageProps\}\s*\/>/.test(nextImport)) {
      next = nextImport.replace(/<Component\s+\{\.\.\.pageProps\}\s*\/>/, "<><AsiystAssistant /><Component {...pageProps} /></>");
    } else if (/\<Outlet\s*\/>/.test(nextImport)) {
      next = nextImport.replace(/<Outlet\s*\/>/, "<><AsiystAssistant /><Outlet /></>");
    } else if (componentPath.endsWith(".ts") || componentPath.endsWith(".js")) {
      next = nextImport;
    } else {
      throw new Error(`Could not find a safe render location in ${path}. Add <AsiystAssistant /> to this entry point.`);
    }
  }
  if (next === current) return "unchanged";
  writeFileSync(path, next, "utf8");
  return "update";
}

export function planIntegration(project: ProjectDetection, values: IntegrationValues): IntegrationPlan {
  if (!values.projectId || !values.publicKey) {
    throw new Error("Verified projectId and publicKey are required before configuring the SDK.");
  }
  const paths = pathsFor(project);
  const componentPath = resolve(project.cwd, paths.component);
  const entryPath = paths.entry;
  if (!entryPath) {
    return {
      framework: project.framework,
      sdkInstalled: isSdkInstalled(project),
      sdkVersion: project.sdkVersion,
      componentPath,
      componentAction: existsSync(componentPath) ? "update" : "create",
      entryAction: "unsupported",
      reason: "No supported React entry point was detected. Add AsiystAssistant to the website entry point manually.",
    };
  }
  return {
    framework: project.framework,
    sdkInstalled: isSdkInstalled(project),
    sdkVersion: project.sdkVersion,
    componentPath,
    entryPath,
    componentAction: existsSync(componentPath) ? "update" : "create",
    entryAction: entryPath ? "update" : "unsupported",
    reason: entryPath ? undefined : "No supported application entry point was detected.",
  };
}

export async function installSdk(project: ProjectDetection): Promise<void> {
  const commands: Record<string, { command: string; args: string[] }> = {
    npm: { command: "npm", args: ["install", "@asiyst/sdk"] },
    pnpm: { command: "pnpm", args: ["add", "@asiyst/sdk"] },
    yarn: { command: "yarn", args: ["add", "@asiyst/sdk"] },
    bun: { command: "bun", args: ["add", "@asiyst/sdk"] },
  };
  const selected = commands[project.packageManager] ?? commands.npm;
  await execFileAsync(selected.command, selected.args, { cwd: project.cwd, windowsHide: true });
}

export async function runProjectValidation(project: ProjectDetection): Promise<void> {
  const scripts = project.packageJson?.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return;
  const available = scripts as Record<string, unknown>;
  const checks = ["lint", "typecheck", "type-check", "build"]
    .filter((name, index, names) => typeof available[name] === "string" && names.indexOf(name) === index);
  for (const script of checks) {
    const command = project.packageManager === "npm" ? "npm" : project.packageManager;
    const args = project.packageManager === "npm" ? ["run", script] : ["run", script];
    try {
      const result = await execFileAsync(command, args, { cwd: project.cwd, windowsHide: true });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    } catch (error) {
      const commandError = error as { stdout?: string | Buffer; stderr?: string | Buffer };
      if (commandError.stdout) process.stdout.write(String(commandError.stdout));
      if (commandError.stderr) process.stderr.write(String(commandError.stderr));
      throw error;
    }
  }
}

export function applyIntegration(project: ProjectDetection, values: IntegrationValues, plan = planIntegration(project, values)): IntegrationResult {
  if (plan.entryAction === "unsupported" || !plan.entryPath) {
    throw new Error(plan.reason ?? "The project entry point could not be detected safely.");
  }
  const paths = pathsFor(project);
  const componentAction = updateComponent(plan.componentPath, componentSource(values, paths.extension), values);
  const entryAction = updateEntry(plan.entryPath, plan.componentPath);
  return { ...plan, componentAction, entryAction, installed: plan.sdkInstalled };
}

export function printDryRun(plan: IntegrationPlan): void {
  console.log(`Framework: ${plan.framework}`);
  console.log(`SDK: ${plan.sdkInstalled ? `installed${plan.sdkVersion ? ` (${plan.sdkVersion})` : ""}` : "missing"}`);
  console.log(`Component: ${plan.componentAction} ${plan.componentPath}`);
  console.log(`Entry point: ${plan.entryPath ? `${plan.entryAction} ${plan.entryPath}` : "not detected"}`);
  if (plan.reason) console.log(`Note: ${plan.reason}`);
}

export function readIntegrationValues(plan: IntegrationPlan): Partial<IntegrationValues> {
  if (!existsSync(plan.componentPath)) return {};
  return extractIntegrationValues(read(plan.componentPath));
}

function extractIntegrationValues(source: string): Partial<IntegrationValues> {
  const value = (name: string): string | undefined => {
    const match = source.match(new RegExp(`${name}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    return match?.[1];
  };
  return {
    projectId: value("projectId"),
    publicKey: value("publicKey"),
    avatarId: value("avatarId"),
  };
}

export function inspectIntegration(project: ProjectDetection): IntegrationStatus {
  if (!isSdkInstalled(project)) {
    return { sdkInstalled: false, initialized: false };
  }
  const paths = pathsFor(project);
  const componentPath = resolve(project.cwd, paths.component);
  const files: string[] = [];
  const visit = (directory: string, depth: number): void => {
    if (depth > 8 || !existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path, depth + 1);
      else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name)) files.push(path);
    }
  };
  visit(project.cwd, 0);
  if (existsSync(componentPath) && !files.includes(componentPath)) files.unshift(componentPath);
  const sources = files.map((path) => ({ path, source: read(path) }));
  const initializedSource = sources.find(({ source }) =>
    /Asiyst\.init\s*\(/.test(source) && Boolean(extractIntegrationValues(source).projectId));
  if (!initializedSource) {
    return { sdkInstalled: true, sdkVersion: project.sdkVersion, initialized: false };
  }
  const values = extractIntegrationValues(initializedSource.source);
  return {
    sdkInstalled: true,
    sdkVersion: project.sdkVersion,
    initialized: true,
    projectId: values.projectId,
    publicKey: values.publicKey,
    avatarId: values.avatarId,
  };
}
