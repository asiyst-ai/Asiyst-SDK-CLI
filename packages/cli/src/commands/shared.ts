import { ApiClient } from "../api/client.js";
import { openBrowser } from "../browser/open.js";
import type { CliSession, SafeProjectInfo } from "../types.js";
import { selectOption } from "../ui/selector.js";

export async function connect(api = new ApiClient()): Promise<{ session: CliSession; project?: SafeProjectInfo }> {
  await api.health();
  const session = await api.createSession();
  console.log(`Opening Asiyst...\n${session.connectUrl}`);
  if (!(await openBrowser(session.connectUrl))) console.log("Automatic browser opening failed; open the URL above.");
  console.log("● Waiting for authentication\n● Waiting for project selection\n● Waiting for connection");
  const expires = Date.parse(session.expiresAt);
  for (;;) {
    const result = await api.sessionStatus(session.sessionId);
    if (result.state === "completed") return { session, project: result.project };
    if (result.state === "expired") throw new Error("Connection session expired.");
    if (result.state === "cancelled") throw new Error("Connection session was cancelled.");
    if (Number.isFinite(expires) && Date.now() >= expires) throw new Error("Connection session expired.");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return true;
  const result = await selectOption(question, [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ]);
  return result.type === "selected" && result.value;
}
