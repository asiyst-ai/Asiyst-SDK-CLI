import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

declare const __ASIYST_CLI_VERSION__: string | undefined;

export function readCurrentVersion(): string {
  if (typeof __ASIYST_CLI_VERSION__ === "string" && __ASIYST_CLI_VERSION__) return __ASIYST_CLI_VERSION__;
  try {
    const packageJson: unknown = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
    if (packageJson && typeof packageJson === "object" && typeof (packageJson as Record<string, unknown>).version === "string") {
      return (packageJson as Record<string, string>).version;
    }
  } catch {
    // Source and bundled layouts differ; the build injects __ASIYST_CLI_VERSION__.
  }
  try {
    const packageJson: unknown = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));
    if (packageJson && typeof packageJson === "object" && typeof (packageJson as Record<string, unknown>).version === "string" && (packageJson as Record<string, unknown>).name === "@asiyst/cli") {
      return (packageJson as Record<string, string>).version;
    }
  } catch {
    // Ignore unrelated package.json files, including the monorepo root.
  }
  return "0.0.0";
}
