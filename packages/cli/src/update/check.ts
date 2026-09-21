import { readCurrentVersion } from "../config/version.js";
import { createCliLifecycleEmitter } from "../lifecycle.js";

const cliLifecycle = createCliLifecycleEmitter();

export type InstallKind = "npx" | "global" | "local";

export async function checkForUpdate(
  currentVersion = readCurrentVersion(),
  fetcher: typeof fetch = fetch,
): Promise<{ currentVersion: string; latestVersion?: string }> {
  let response: Response;
  try {
    response = await fetcher("https://registry.npmjs.org/@asiyst/cli/latest", { headers: { Accept: "application/json" } });
  } catch {
    return { currentVersion };
  }
  if (!response.ok) {
    return { currentVersion };
  }
  const body = await response.json() as { version?: string };
  return body.version ? { currentVersion, latestVersion: body.version } : { currentVersion };
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string): { core: number[]; pre: string[] } => {
    const [coreText, preText] = value.split("-", 2);
    return {
      core: coreText.split(".").map((part) => Number(part.replace(/[^0-9]/g, ""))).map((part) => Number.isFinite(part) ? part : 0),
      pre: preText ? preText.split(".") : [],
    };
  };
  const leftParsed = parse(left);
  const rightParsed = parse(right);
  for (let index = 0; index < Math.max(leftParsed.core.length, rightParsed.core.length); index += 1) {
    const leftPart = leftParsed.core[index] ?? 0;
    const rightPart = rightParsed.core[index] ?? 0;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  if (leftParsed.pre.length === 0 && rightParsed.pre.length > 0) return 1;
  if (leftParsed.pre.length > 0 && rightParsed.pre.length === 0) return -1;
  for (let index = 0; index < Math.max(leftParsed.pre.length, rightParsed.pre.length); index += 1) {
    const leftPart = leftParsed.pre[index];
    const rightPart = rightParsed.pre[index];
    if (leftPart === rightPart) continue;
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber > rightNumber ? 1 : -1;
    if (leftNumber !== undefined) return -1;
    if (rightNumber !== undefined) return 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export async function notifyIfUpdateAvailable(): Promise<void> {
  const result = await checkForUpdate();
  if (result.latestVersion && compareVersions(result.latestVersion, result.currentVersion) > 0) {
    cliLifecycle.emit("cli.version_outdated", {
      currentVersion: result.currentVersion,
      latestVersion: result.latestVersion,
      source: "registry",
    });
    console.log(`\n⚠ New Asiyst CLI version available: ${result.currentVersion} → ${result.latestVersion}\nRun \`update\` to install the latest version.\n`);
  }
}

export function detectInstallKind(
  executablePath = process.argv[1] ?? "",
  env: NodeJS.ProcessEnv = process.env,
  globalRootResolver: () => string | undefined = () => undefined,
): InstallKind {
  if (env.npm_command === "exec" || /[\\/]_npx[\\/]/i.test(executablePath)) return "npx";
  return "local";
}

export function installLatest(
  latestVersion: string,
  kind: InstallKind,
  executablePath = process.argv[1] ?? "",
  runner: (file: string, args: string[], options?: { encoding?: BufferEncoding; stdio?: "inherit" }) => string | Buffer | undefined = () => undefined,
): string | undefined {
  if (kind === "npx") {
    const output = runner("npx.cmd", ["--yes", `@asiyst/cli@${latestVersion}`, "--version"], { encoding: "utf8" });
    return typeof output === "string" ? output.trim() : undefined;
  }
  return undefined;
}
