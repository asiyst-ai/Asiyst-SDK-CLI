import { createOnboardingSession, createWebHandoff } from "../api/onboarding.js";
import { ApiError } from "../api/errors.js";
import { ApiClient } from "../api/client.js";
import { loadOnboardingSession } from "../config/credentials.js";
import { openBrowser } from "./open.js";
import { ASIYST_PRODUCTION_ORIGIN, buildAsiystUrl, logOpeningUrl, toRelativeHandoffPath } from "./urls.js";
import { isDebugEnabled } from "../config/api.js";

export async function openAuthenticatedWebPage(
  api: ApiClient,
  path: string,
  session?: Awaited<ReturnType<typeof loadOnboardingSession>>,
  label?: string,
): Promise<boolean> {
  const authSession = session ?? await loadOnboardingSession();
  if (!authSession) throw new ApiError("Your Asiyst session has expired. Please run /login.", 401, "SESSION_EXPIRED");
  if (authSession.expiresAt && Number.isNaN(Date.parse(authSession.expiresAt)) === false && Date.parse(authSession.expiresAt) <= Date.now()) {
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

  // The login session authenticates the CLI API request. The web handoff
  // contract requires a separate short-lived onboarding reference.
  let onboardingSession;
  try {
    // The authenticated CLI headers are the source of identity. The web endpoint
    // derives and binds the user server-side; do not trust or duplicate a user ID
    // in the request body.
    onboardingSession = await createOnboardingSession(api, authSession.sessionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(
        "Asiyst rejected the authenticated CLI session while creating the browser handoff. The local session was preserved; run /login only if this persists.",
        401,
        "SESSION_EXPIRED",
      );
    }
    throw error;
  }
  const relativePath = toRelativeHandoffPath(targetUrl);
  let handoff;
  try {
    handoff = await createWebHandoff(api, onboardingSession, relativePath);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError("Unable to establish the Asiyst browser session. The handoff authorization was rejected.", 401, "HANDOFF_FAILED");
    }
    if (error instanceof ApiError && error.status === 403) {
      throw new ApiError("Unable to establish the Asiyst browser session. This account is not authorized for the requested page.", 403, "HANDOFF_FAILED");
    }
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError("Unable to establish the Asiyst browser session. The handoff was already used or conflicts with another request.", 409, "HANDOFF_FAILED");
    }
    if (error instanceof ApiError && error.status === 410) {
      throw new ApiError("Unable to establish the Asiyst browser session. The handoff has expired.", 410, "HANDOFF_FAILED");
    }
    const status = error instanceof ApiError ? error.status : undefined;
    throw new ApiError(
      error instanceof ApiError && error.message
        ? `Unable to establish the Asiyst browser session. ${error.message}`
        : "Unable to establish the Asiyst browser session.",
      status,
      "HANDOFF_FAILED",
    );
  }

  if (onboardingSession.userId && onboardingSession.userId !== authSession.userId) {
    throw new ApiError("The browser handoff account did not match the authenticated CLI account.", 409, "USER_MISMATCH");
  }

  let url: URL;
  if (handoff.url) {
    try {
      url = buildAsiystUrl(handoff.url);
    } catch {
      throw new ApiError("The API returned an invalid browser handoff URL.", 200, "MALFORMED_RESPONSE");
    }
    const hasHandoffCredential = ["token", "handoffToken", "handoff_token"].some((key) => {
      const value = url.searchParams.get(key);
      return Boolean(value?.trim());
    });
    const isLegacyHandoff = url.origin === ASIYST_PRODUCTION_ORIGIN
      && url.pathname === "/cli/onboarding/handoff"
      && hasHandoffCredential;
    let redirectTo: URL | undefined;
    const redirectTarget = url.searchParams.get("redirectTo");
    if (redirectTarget) {
      try {
        redirectTo = new URL(redirectTarget, ASIYST_PRODUCTION_ORIGIN);
      } catch {
        redirectTo = undefined;
      }
    }
    const browserSessionId = url.searchParams.get("browser_session_id")?.trim()
      ?? redirectTo?.searchParams.get("browser_session_id")?.trim();
    const state = url.searchParams.get("state")?.trim()
      ?? redirectTo?.searchParams.get("state")?.trim();
    const isBrowserAuthorization = url.origin === ASIYST_PRODUCTION_ORIGIN
      && (url.pathname === "/login" || url.pathname === "/cli/authorize")
      && (url.pathname === "/cli/authorize" || Boolean(url.searchParams.get("challenge")?.trim()))
      && (!redirectTo || (redirectTo.origin === ASIYST_PRODUCTION_ORIGIN && redirectTo.pathname === "/cli/authorize"))
      && Boolean(browserSessionId)
      && Boolean(state);
    if (!isLegacyHandoff && !isBrowserAuthorization) {
      throw new ApiError("The API returned an invalid browser handoff URL.", 200, "MALFORMED_RESPONSE");
    }
  } else {
    url = buildAsiystUrl("/cli/onboarding/handoff", { token: handoff.token });
  }
  const opened = await openBrowser(url.toString());
  if (isDebugEnabled()) {
    console.error(`[asiyst-debug] browser handoff open result: ${opened ? "success" : "failure"}`);
  }
  if (!opened) {
    console.log("✗ Unable to open the browser automatically.");
    console.log("→ Open this URL manually:");
    console.log(url.toString().replace(/([?&](?:token|handoffToken|handoff_token)=)[^&]+/gi, "$1REDACTED"));
  }
  return opened;
}
