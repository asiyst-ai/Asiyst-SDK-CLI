import { openBrowser } from "../browser/open.js";
export async function dashboardCommand(): Promise<void> {
  const configured = process.env.ASIIYST_DASHBOARD_URL || "https://asiyst.com/dashboard";
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && !(parsed.hostname === "localhost" && parsed.protocol === "http:")) throw new Error("Configured dashboard URL must use HTTPS.");
  const url = parsed.toString();
  if (!(await openBrowser(url))) console.log(`Open ${url}`);
  else console.log(`Opening ${url}`);
}
