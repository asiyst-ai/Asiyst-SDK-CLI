import { openBrowser } from "../browser/open.js";
import { ASIIYST_WEB_URL } from "../config/api.js";

export async function dashboardCommand(): Promise<void> {
  const url = ASIIYST_WEB_URL;
  if (!(await openBrowser(url))) console.log(`Open this URL manually:\n${url}`);
  else console.log(`Opening ${url}`);
}
