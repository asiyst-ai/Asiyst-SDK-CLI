import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectDetection } from "../types.js";

export function hasConfiguration(project: ProjectDetection): boolean {
  return Boolean(project.config.projectId && project.config.publicKey);
}

export function configWarning(cwd: string): string | undefined {
  const envPath = resolve(cwd, ".env");
  if (existsSync(envPath)) {
    const ignored = existsSync(resolve(cwd, ".gitignore")) &&
      readFileSync(resolve(cwd, ".gitignore"), "utf8").split(/\r?\n/).some((line) => line.trim() === ".env" || line.trim() === ".env.*");
    if (!ignored) return "Your .env file is not clearly ignored by .gitignore; do not commit public or private configuration accidentally.";
  }
  return undefined;
}
