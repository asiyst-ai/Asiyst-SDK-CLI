import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function readCurrentVersion(): string {
  for (const packageUrl of [
    new URL("../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url),
    new URL("../../../package.json", import.meta.url),
  ]) {
    try {
      const packageJson: unknown = JSON.parse(readFileSync(fileURLToPath(packageUrl), "utf8"));
      if (packageJson && typeof packageJson === "object" && typeof (packageJson as Record<string, unknown>).version === "string") {
        return (packageJson as Record<string, string>).version;
      }
    } catch {
      // Keep CLI commands available if package metadata cannot be read.
    }
  }
  return "0.2.0";
}
