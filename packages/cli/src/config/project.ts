import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ConnectedProject, ProjectMetadata } from "../types.js";

export const PROJECT_CONFIG_DIR = ".asiyst";
export const PROJECT_CONFIG_FILE = "config.json";

export function projectConfigPath(cwd: string): string {
  return join(resolve(cwd), PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
}

export function readProjectMetadata(cwd: string): ProjectMetadata | undefined {
  const path = projectConfigPath(cwd);
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const body = parsed as Record<string, unknown>;
    if (typeof body.apiKey === "string") delete body.apiKey;
    return {
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      projectName: typeof body.projectName === "string" ? body.projectName : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      publicKey: typeof body.publicKey === "string" ? body.publicKey : undefined,
      connected: body.connected === true,
    };
  } catch {
    return undefined;
  }
}

export function writeProjectMetadata(cwd: string, connection: ConnectedProject): void {
  const dir = join(resolve(cwd), PROJECT_CONFIG_DIR);
  mkdirSync(dir, { recursive: true });
  const existing = readProjectMetadata(cwd) ?? {};
  const next: ProjectMetadata = {
    ...existing,
    projectId: connection.projectId,
    projectName: connection.projectName,
    website: connection.website,
    publicKey: connection.publicKey,
    connected: true,
  };
  writeFileSync(projectConfigPath(cwd), `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8" });
}

export function clearProjectMetadata(cwd: string): void {
  const path = projectConfigPath(cwd);
  if (!existsSync(path)) return;
  const existing = readProjectMetadata(cwd) ?? {};
  const next: ProjectMetadata = {
    ...existing,
    connected: false,
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8" });
}
