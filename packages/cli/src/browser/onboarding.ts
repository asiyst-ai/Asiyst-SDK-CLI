import { createWebHandoff } from "../api/onboarding.js";
import { ApiError } from "../api/errors.js";
import { ApiClient } from "../api/client.js";
import { clearOnboardingSession, loadOnboardingSession } from "../config/credentials.js";
import { ASIYST_WEB_URL } from "../config/api.js";
import { openBrowser } from "./open.js";
import { buildAsiystUrl, logOpeningUrl, toRelativeHandoffPath } from "./urls.js";

export async function openAuthenticatedWebPage(
  api: ApiClient,
  path: string,
  session?: Awaited<ReturnType<typeof loadOnboardingSession>>,
  label?: string,
): Promise<boolean> {
  const authSession = session ?? await loadOnboardingSession();
  if (!authSession) throw new ApiError("Your Asiyst session has expired. Please run /login.", 401, "SESSION_EXPIRED");
  if (authSession.expiresAt && Number.isNaN(Date.parse(authSession.expiresAt)) === false && Date.parse(authSession.expiresAt) <= Date.now()) {
    await clearOnboardingSession();
    throw new ApiError("Your Asiyst session has expired. Please run /login.", 401, "SESSION_EXPIRED");
  }

  // Build clean target URL strictly on https://asiyst.com
  let targetUrl: URL;
  try {
    targetUrl = buildAsiystUrl(path);
  } catch {
    throw new ApiError("The generated Asiyst URL is invalid or malformed.", 400, "INVALID_REQUEST");
  }

  if (label) {
    logOpeningUrl(label, targetUrl);
  }

  const relativePath = toRelativeHandoffPath(targetUrl);
  let handoff;
  try {
    handoff = await createWebHandoff(api, authSession, relativePath);
  } catch (error) {
    if (error instanceof ApiError && error.code === "SESSION_EXPIRED") {
      await clearOnboardingSession();
      throw error;
    }
    // If handoff endpoint is unavailable (e.g. mock or backend without handoff), try opening direct URL
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return openBrowser(targetUrl.toString());
    }
    throw error;
  }

  const url = new URL("/cli/onboarding/handoff", ASIYST_WEB_URL);
  url.searchParams.set("token", handoff.token);
  return openBrowser(url.toString());
}


