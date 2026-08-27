import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectDetection } from "../types.js";

function dependencyVersion(pkg: Record<string, unknown>): string | undefined {
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  for (const section of sections) {
    const values = pkg[section];
    if (values && typeof values === "object" && "@asiyst/sdk" in values) {
      const version = (values as Record<string, unknown>)["@asiyst/sdk"];
      return typeof version === "string" ? version : undefined;
    }
  }
  return undefined;
}

export function detectFramework(cwd: string, pkg: Record<string, unknown> | null): string {
  const deps: Record<string, unknown> = Object.assign({}, pkg?.dependencies, pkg?.devDependencies);
  if (typeof deps.next === "string") return "Next.js";
  if (typeof deps.react === "string") return "React";
  if (typeof deps.vite === "string") return "Vite";
  if (typeof deps.vue === "string") return "Vue";
  if (existsSync(resolve(cwd, "vite.config.ts")) || existsSync(resolve(cwd, "vite.config.js"))) return "Vite";
  if (existsSync(resolve(cwd, "next.config.js")) || existsSync(resolve(cwd, "next.config.mjs"))) return "Next.js";
  return "Vanilla JavaScript/TypeScript";
}

function readEnv(cwd: string): Record<string, string> {
  const result: Record<string, string> = {};
  const path = resolve(cwd, ".env");
  if (!existsSync(path)) return result;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !match[1].toLowerCase().includes("secret") && !match[1].toLowerCase().includes("token")) {
      result[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return result;
}

export function detectProject(cwd = process.cwd()): ProjectDetection {
  const path = resolve(cwd, "package.json");
  let packageJson: Record<string, unknown> | null = null;
  if (existsSync(path)) {
    try {
      const value: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (value && typeof value === "object" && !Array.isArray(value)) packageJson = value as Record<string, unknown>;
    } catch {
      packageJson = null;
    }
  }
  const env = { ...readEnv(cwd), ...process.env } as Record<string, string | undefined>;
  return {
    cwd,
    packageJson,
    sdkVersion: packageJson ? dependencyVersion(packageJson) : undefined,
    framework: detectFramework(cwd, packageJson),
    config: {
      projectId: env.ASIIYST_PROJECT_ID,
      publicKey: env.ASIIYST_PUBLIC_KEY,
    },
  };
}
