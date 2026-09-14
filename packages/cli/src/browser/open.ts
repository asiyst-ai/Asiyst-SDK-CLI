import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

export async function openBrowser(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || (parsed.hostname !== "asiyst.com" && !parsed.hostname.endsWith(".asiyst.com"))) {
    return false;
  }
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    if (process.platform !== "win32") return false;
    try {
      // Some Windows installations reject rundll32 for HTTPS URLs; use the
      // shell's registered HTTPS handler as a safe fallback.
      await execFileAsync("cmd.exe", ["/d", "/c", "start", "", url]);
      return true;
    } catch {
      return false;
    }
  }
}
