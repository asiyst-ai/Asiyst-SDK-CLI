import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readCurrentVersion } from "../config/version.js";

const PACKAGE_NAME = "@asiyst/cli";
const REGISTRY_URL = "https://registry.npmjs.org/%40asiyst%2Fcli/latest";
const TIMEOUT_MS = 800;
type CommandRunner = (file: string, args: string[], options: { encoding?: BufferEncoding; stdio?: "inherit" }) => string | Buffer | undefined;
const defaultRunner: CommandRunner = (file, args, options) => execFileSync(file, args, options);

export interface UpdateInfo {
  currentVersion: string;
  latestVersion?: string;
}

function parseVersion(value: string): { numbers: number[]; prerelease: string[] } | undefined {
  const match = /^[v=]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim());
  return match
    ? { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4]?.split(".") ?? [] }
    : undefined;
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber > rightNumber ? 1 : -1;
    if (leftNumber !== undefined) return -1;
    if (rightNumber !== undefined) return 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export async function checkForUpdate(
  currentVersion = readCurrentVersion(),
  fetcher: typeof fetch = fetch,
): Promise<UpdateInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(REGISTRY_URL, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return { currentVersion };
    const body: unknown = await response.json();
    const latestVersion = body && typeof body === "object" && typeof (body as Record<string, unknown>).version === "string"
      ? (body as Record<string, string>).version
      : undefined;
    return latestVersion && parseVersion(latestVersion) ? { currentVersion, latestVersion } : { currentVersion };
  } catch {
    return { currentVersion };
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyIfUpdateAvailable(): Promise<void> {
  const result = await checkForUpdate();
  if (result.latestVersion && compareVersions(result.latestVersion, result.currentVersion) > 0) {
    console.log(`\n⚠ New Asiyst CLI version available: ${result.currentVersion} → ${result.latestVersion}\nRun \`update\` to install the latest version.\n`);
  }
}

export type InstallKind = "npx" | "global" | "local";

export function detectInstallKind(
  executablePath = process.argv[1] ?? "",
  env: NodeJS.ProcessEnv = process.env,
  globalRootResolver: () => string | undefined = () => {
    try {
      return execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["root", "--global"], { encoding: "utf8" }).trim();
    } catch {
      return undefined;
    }
  },
): InstallKind {
  if (env.npm_command === "exec" || /[\\/]_npx[\\/]/i.test(executablePath)) return "npx";
  const globalRoot = globalRootResolver();
  if (globalRoot && executablePath.toLowerCase().startsWith(`${globalRoot.toLowerCase()}\\`)) return "global";
  if (globalRoot && executablePath.toLowerCase().startsWith(`${globalRoot.toLowerCase()}/`)) return "global";
  return "local";
}

function installedVersion(packageRoot: string): string | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(`${packageRoot}/package.json`, "utf8"));
    return value && typeof value === "object" && typeof (value as Record<string, unknown>).version === "string"
      ? (value as Record<string, string>).version
      : undefined;
  } catch {
    return undefined;
  }
}

export function installLatest(
  latestVersion: string,
  kind: InstallKind,
  executablePath = process.argv[1] ?? "",
  runner: CommandRunner = defaultRunner,
): string | undefined {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  if (kind === "global") {
    runner(executable, ["install", "--global", `${PACKAGE_NAME}@${latestVersion}`], { stdio: "inherit" });
    const packageRoot = executablePath.replace(/[\\/]dist[\\/][^\\/]+$/, "");
    return installedVersion(packageRoot);
  }
  if (kind === "npx") {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const output = runner(npx, ["--yes", `${PACKAGE_NAME}@${latestVersion}`, "--version"], { encoding: "utf8" });
    return typeof output === "string" ? output.trim().split(/\r?\n/).pop() : undefined;
  }
  return undefined;
}
