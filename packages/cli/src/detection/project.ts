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

function installedSdkVersion(cwd: string): string | undefined {
  let directory = resolve(cwd);
  for (;;) {
    const manifestPath = resolve(directory, "node_modules", "@asiyst", "sdk", "package.json");
    if (existsSync(manifestPath)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
          && typeof (parsed as Record<string, unknown>).version === "string") {
          return (parsed as Record<string, unknown>).version as string;
        }
      } catch {
        return undefined;
      }
    }
    const parent = resolve(directory, "..");
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function hasDependency(deps: Record<string, unknown>, name: string): boolean {
  return typeof deps[name] === "string";
}

export function detectFramework(cwd: string, pkg: Record<string, unknown> | null): string {
  const deps: Record<string, unknown> = Object.assign({}, pkg?.dependencies, pkg?.devDependencies);
  if (hasDependency(deps, "@tanstack/react-start") || hasDependency(deps, "@tanstack/start")) {
    return "tanstack_start_ts";
  }
  if (hasDependency(deps, "next") || existsSync(resolve(cwd, "next.config.js")) || existsSync(resolve(cwd, "next.config.mjs")) || existsSync(resolve(cwd, "next.config.ts"))) {
    return "Next.js";
  }

  if (hasDependency(deps, "nuxt")) return "Nuxt";
  if (hasDependency(deps, "vue") || existsSync(resolve(cwd, "vue.config.js"))) return "Vue";
  if (hasDependency(deps, "react")) return "React";
  if (hasDependency(deps, "vite") || existsSync(resolve(cwd, "vite.config.ts")) || existsSync(resolve(cwd, "vite.config.js")) || existsSync(resolve(cwd, "vite.config.mjs"))) {
    return "Vite";
  }
  if (pkg) return existsSync(resolve(cwd, "tsconfig.json")) ? "Vanilla TypeScript" : "Vanilla JavaScript";
  return "Unknown";
}

export function resolveApplicationEntryPoint(cwd: string, framework: string, language: string): {
  entryPoint?: string;
  strategy?: string;
  reason: string;
} {
  const extension = language === "TypeScript" ? ["tsx", "ts", "jsx", "js"] : ["jsx", "js", "tsx", "ts"];
  const candidates = framework === "tanstack_start_ts"
    ? extension.flatMap((ext) => [`src/routes/__root.${ext}`, `src/entry.client.${ext}`, `src/entry.${ext}`])
    : extension.flatMap((ext) => [
        `src/main.${ext}`, `src/index.${ext}`, `src/App.${ext}`, `src/app.${ext}`,
        `src/root.${ext}`, `src/routes.${ext}`, `src/entry.client.${ext}`, `src/entry.${ext}`,
      ]);
  const entryPoint = candidates.find((candidate) => existsSync(resolve(cwd, candidate)));
  const installedVersion = installedSdkVersion(cwd);
  return {
    entryPoint,
    strategy: entryPoint && framework === "tanstack_start_ts" ? "root-client-integration" : entryPoint ? "application-entry-integration" : undefined,
    reason: entryPoint ? `Detected ${entryPoint} as the application entry point.` : "No supported application entry point was detected.",
  };
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
  const env = process.env as Record<string, string | undefined>;
  const packageManager = existsSync(resolve(cwd, "pnpm-lock.yaml")) ? "pnpm" :
    existsSync(resolve(cwd, "yarn.lock")) ? "yarn" :
      existsSync(resolve(cwd, "bun.lockb")) || existsSync(resolve(cwd, "bun.lock")) ? "bun" : "npm";
  const sourceFiles = ["tsconfig.json", "src", "app"].some((entry) => existsSync(resolve(cwd, entry)));
  const framework = detectFramework(cwd, packageJson);
  const language = sourceFiles ? "TypeScript" : "JavaScript";
  const entry = resolveApplicationEntryPoint(cwd, framework, language);
  const installedVersion = installedSdkVersion(cwd);
  return {
    cwd,
    packageJson,
    sdkVersion: installedVersion ?? (packageJson ? dependencyVersion(packageJson) : undefined),
    sdkInstalled: Boolean(installedVersion),
    framework,
    language,
    packageManager,
    config: {
      projectId: env.ASIIYST_PROJECT_ID,
      publicKey: env.ASIIYST_PUBLIC_KEY,
    },
    entryPoint: entry.entryPoint,
    entryStrategy: entry.strategy,
  };
}
