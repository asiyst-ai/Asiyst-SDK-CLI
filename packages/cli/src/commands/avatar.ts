import { openBrowser } from "../browser/open.js";
import { ASIIYST_WEB_URL } from "../config/api.js";
import { loadConnection } from "../config/credentials.js";

export async function avatarCommand(cwd = process.cwd()): Promise<void> {
  const stored = await loadConnection(cwd);
  if (!stored) {
    console.log("Connect your project to Asiyst to view stats.");
    const url = ASIIYST_WEB_URL;
    if (await openBrowser(url)) console.log(`Opening ${url}`);
    else console.log(`Open this URL manually:\n${url}`);
    return;
  }
  console.log(`Avatar configuration is managed at ${ASIIYST_WEB_URL}.`);
  if (!(await openBrowser(ASIIYST_WEB_URL))) console.log(`Open this URL manually:\n${ASIIYST_WEB_URL}`);
}
