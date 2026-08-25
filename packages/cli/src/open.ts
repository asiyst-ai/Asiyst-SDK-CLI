import { spawn } from "node:child_process";
import { platform } from "node:os";

export function openUrl(url: string): void {
  const spec = platform();
  const command = spec === "win32" ? "cmd" : spec === "darwin" ? "open" : "xdg-open";
  const args = spec === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}
