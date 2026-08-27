import { openBrowser } from "../browser/open.js";
export async function dashboardCommand(): Promise<void> {
  const url = "https://asiyst.com/dashboard";
  if (!(await openBrowser(url))) console.log(`Open ${url}`);
  else console.log(`Opening ${url}`);
}
