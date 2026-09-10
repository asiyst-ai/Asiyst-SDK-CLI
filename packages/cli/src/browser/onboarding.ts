import { createOnboardingSession, createWebHandoff } from "../api/onboarding.js";
import { ApiError } from "../api/errors.js";
import { ApiClient } from "../api/client.js";
import { clearOnboardingSession, loadOnboardingSession } from "../config/credentials.js";
import { ASIYST_WEB_URL } from "../config/api.js";
import { openBrowser } from "./open.js";

export async function openAuthenticatedWebPage(
  api: ApiClient,
  path: string,
  session?: Awaited<ReturnType<typeof loadOnboardingSession>>,
): Promise<boolean> {
  const authSession = session ?? await loadOnboardingSession();
  if (!authSession) throw new ApiError("Your Asiyst session has expired. Please reconnect your account.", 401, "SESSION_EXPIRED");
  if (authSession.expiresAt && Number.isNaN(Date.parse(authSession.expiresAt)) === false && Date.parse(authSession.expiresAt) <= Date.now()) {
    await clearOnboardingSession();
    throw new ApiError("Your Asiyst session has expired. Please reconnect your account.", 401, "SESSION_EXPIRED");
  }
  const activeSession = session ?? await createOnboardingSession(api, authSession.userId, authSession.sessionId);
  let handoff;
  try {
    handoff = await createWebHandoff(api, activeSession, path);
  } catch (error) {
    if (error instanceof ApiError && error.code === "SESSION_EXPIRED") await clearOnboardingSession();
    throw error;
  }
  const url = new URL("/cli/onboarding/handoff", ASIYST_WEB_URL);
  url.searchParams.set("token", handoff.token);
  return openBrowser(url.toString());
}
