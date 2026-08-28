import { openBrowser } from "../browser/open.js";
import { ASIIYST_WEB_URL } from "../config/api.js";
export async function dashboardCommand(): Promise<void> {
  const configured = process.env.ASIIYST_DASHBOARD_URL || ASIIYST_WEB_URL;
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:") throw new Error("Configured dashboard URL must use HTTPS.");
  const url = parsed.toString();
  if (!(await openBrowser(url))) console.log(`Open ${url}`);
  else console.log(`Opening ${url}`);
}
