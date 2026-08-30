import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { ConnectedProject } from "../types.js";

const execFileAsync = promisify(execFile);
const SERVICE = "Asiyst CLI";

function configDir(): string {
  if (process.platform === "win32") return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "asiyst");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "asiyst");
  return join(homedir(), ".config", "asiyst");
}

function storePath(): string {
  return join(configDir(), "credentials.json");
}

function accountFor(cwd: string): string {
  return resolve(cwd);
}

function readStore(): Record<string, ConnectedProject> {
  const path = storePath();
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, ConnectedProject>;
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, ConnectedProject>): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(storePath(), JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function dpapiProtect(plaintext: string): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$bytes = [System.Text.Encoding]::UTF8.GetBytes($env:ASIYST_DPAPI_PAYLOAD)",
    "$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Convert]::ToBase64String($protected)",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, ASIYST_DPAPI_PAYLOAD: plaintext },
      windowsHide: true,
    });
    const value = stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

async function dpapiUnprotect(payload: string): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$protected = [Convert]::FromBase64String($env:ASIYST_DPAPI_PAYLOAD)",
    "$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[System.Text.Encoding]::UTF8.GetString($bytes)",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, ASIYST_DPAPI_PAYLOAD: payload },
      windowsHide: true,
    });
    const value = stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function windowsBlobPath(): string {
  return join(configDir(), "credentials.dpapi");
}

export async function saveConnection(cwd: string, connection: ConnectedProject): Promise<void> {
  const account = accountFor(cwd);
  const next = { ...readStore(), [account]: connection };
  if (process.platform === "win32") {
    const protectedBlob = await dpapiProtect(JSON.stringify(next));
    if (protectedBlob) {
      mkdirSync(configDir(), { recursive: true, mode: 0o700 });
      writeFileSync(windowsBlobPath(), protectedBlob, { encoding: "utf8", mode: 0o600 });
      if (existsSync(storePath())) unlinkSync(storePath());
      return;
    }
  }
  writeStore(next);
}

export async function loadConnection(cwd: string): Promise<ConnectedProject | undefined> {
  const account = accountFor(cwd);
  if (process.platform === "win32" && existsSync(windowsBlobPath())) {
    const decrypted = await dpapiUnprotect(readFileSync(windowsBlobPath(), "utf8"));
    if (decrypted) {
      try {
        const parsed: unknown = JSON.parse(decrypted);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const entry = (parsed as Record<string, ConnectedProject>)[account];
          if (entry && typeof entry.apiKey === "string" && typeof entry.projectId === "string") return entry;
        }
      } catch {
        return undefined;
      }
    }
  }
  const entry = readStore()[account];
  if (entry && typeof entry.apiKey === "string" && typeof entry.projectId === "string") return entry;
  return undefined;
}

export async function clearConnection(cwd: string): Promise<void> {
  const account = accountFor(cwd);
  if (process.platform === "win32" && existsSync(windowsBlobPath())) {
    const decrypted = await dpapiUnprotect(readFileSync(windowsBlobPath(), "utf8"));
    let next: Record<string, ConnectedProject> = {};
    if (decrypted) {
      try {
        const parsed: unknown = JSON.parse(decrypted);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) next = { ...(parsed as Record<string, ConnectedProject>) };
      } catch {
        next = {};
      }
    }
    delete next[account];
    if (Object.keys(next).length === 0) {
      unlinkSync(windowsBlobPath());
      return;
    }
    const protectedBlob = await dpapiProtect(JSON.stringify(next));
    if (protectedBlob) {
      writeFileSync(windowsBlobPath(), protectedBlob, { encoding: "utf8", mode: 0o600 });
      return;
    }
  }
  const next = readStore();
  delete next[account];
  if (Object.keys(next).length === 0 && existsSync(storePath())) unlinkSync(storePath());
  else writeStore(next);
}

export { SERVICE };
