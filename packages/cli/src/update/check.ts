import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@asiyst/cli";
const REGISTRY_URL = "https://registry.npmjs.org/%40asiyst%2Fcli/latest";
const UPDATE_ATTEMPTED = "ASIIYST_UPDATE_ATTEMPTED";
const TIMEOUT_MS = 1500;

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion?: string;
}

export function readCurrentVersion(): string {
  for (const packageUrl of [new URL("../package.json", import.meta.url), new URL("../../package.json", import.meta.url)]) {
    try {
      const packageJson: unknown = JSON.parse(readFileSync(fileURLToPath(packageUrl), "utf8"));
      if (packageJson && typeof packageJson === "object" && typeof (packageJson as Record<string, unknown>).version === "string") {
        return (packageJson as Record<string, string>).version;
      }
    } catch {
      // Source execution and bundled execution resolve package metadata at different levels.
    }
  }
  return "0.2.0";
}

function versionParts(version: string): { numbers: number[]; prerelease: string[] } | undefined {
  const match = /^[v=]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim());
  if (!match) return undefined;
  return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4]?.split(".") ?? [] };
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
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

export function isCiEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CI === "true" || env.CI === "1" || Boolean(env.GITHUB_ACTIONS || env.BUILD_ID || env.TF_BUILD);
}

export function shouldCheckForUpdate(env: NodeJS.ProcessEnv = process.env, isTTY = Boolean(process.stdout.isTTY)): boolean {
  return !isCiEnvironment(env) && isTTY && env[UPDATE_ATTEMPTED] !== "1";
}

export async function checkForUpdate(
  currentVersion = readCurrentVersion(),
  fetcher: typeof fetch = fetch,
): Promise<UpdateCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(REGISTRY_URL, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return { currentVersion };
    const body: unknown = await response.json();
    const latestVersion = body && typeof body === "object" && typeof (body as Record<string, unknown>).version === "string"
      ? (body as Record<string, string>).version
      : undefined;
    return latestVersion && versionParts(latestVersion) ? { currentVersion, latestVersion } : { currentVersion };
  } catch {
    return { currentVersion };
  } finally {
    clearTimeout(timer);
  }
}

export function updateAndRestart(
  latestVersion: string,
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  runner: typeof execFileSync = execFileSync,
): boolean {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  try {
    runner(executable, ["--yes", `${PACKAGE_NAME}@${latestVersion}`, ...argv], {
      stdio: "inherit",
      env: { ...env, [UPDATE_ATTEMPTED]: "1" },
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkAndUpdate(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!shouldCheckForUpdate(env)) return false;
  const result = await checkForUpdate(readCurrentVersion());
  if (!result.latestVersion || compareVersions(result.latestVersion, result.currentVersion) <= 0) return false;
  console.log(`\nA new version of Asiyst CLI is available.\n\n${result.currentVersion} → ${result.latestVersion}\n\nUpdating Asiyst CLI...`);
  const restarted = updateAndRestart(result.latestVersion, argv, env);
  if (!restarted) console.log("⚠ Automatic update failed; continuing with the current version.");
  return restarted;
}
