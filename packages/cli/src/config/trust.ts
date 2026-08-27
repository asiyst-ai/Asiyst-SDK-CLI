import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const trustFile = join(homedir(), ".config", "asiyst", "trusted-folders.json");

function readTrusted(): string[] {
  if (!existsSync(trustFile)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(trustFile, "utf8"));
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function isTrusted(cwd: string): boolean {
  return readTrusted().includes(resolve(cwd));
}

export function trustFolder(cwd: string): void {
  const folder = resolve(cwd);
  const trusted = readTrusted();
  if (!trusted.includes(folder)) trusted.push(folder);
  mkdirSync(join(homedir(), ".config", "asiyst"), { recursive: true, mode: 0o700 });
  writeFileSync(trustFile, JSON.stringify(trusted, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function revokeTrust(cwd: string): void {
  const folder = resolve(cwd);
  const trusted = readTrusted().filter((item) => item !== folder);
  if (existsSync(trustFile)) writeFileSync(trustFile, JSON.stringify(trusted, null, 2), { encoding: "utf8", mode: 0o600 });
}
