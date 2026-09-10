import { consumeLoginChallenge, createLoginChallenge, pollLoginChallenge } from "../api/cli-auth.js";
import { startCallbackServer, type BrowserCallback } from "../api/callback.js";
import { openBrowser } from "../browser/open.js";
import { ApiError } from "../api/errors.js";
import { clearOnboardingSession, loadOnboardingSession, saveOnboardingSession } from "../config/credentials.js";
import { createApiClient } from "./shared.js";
import type { OnboardingSession } from "../types.js";
import { readCurrentVersion } from "../config/version.js";

let loginInProgress = false;

export async function loginCommand(): Promise<void> {
  if (loginInProgress) {
    throw new ApiError("A login attempt is already in progress.", 409, "CONFLICT");
  }
  loginInProgress = true;
  try {
  const existing = await loadOnboardingSession();
  if (existing && (!existing.expiresAt || Number.isNaN(Date.parse(existing.expiresAt)) || Date.parse(existing.expiresAt) > Date.now())) {
    console.log("✓ Already logged in.");
    console.log(`Account: ${existing.accountEmail ?? existing.userId ?? "authenticated Asiyst account"}`);
    console.log("\nYou can use:");
    console.log("  /connect");
    console.log("  /status");
    console.log("  /test");
    console.log("  /validate");
    console.log("  /deploy");
    console.log("  /publish");
    console.log("  /knowledge");
    return;
  }
  if (existing) await clearOnboardingSession();
  const api = createApiClient();
  const callbackServer = await startCallbackServer();
  try {
    const challenge = await createLoginChallenge(api, {
      redirectUri: callbackServer.redirectUri,
      state: callbackServer.state,
      cliVersion: readCurrentVersion(),
      platform: process.platform,
    });
    console.log("⠋ Starting login...");
    console.log("\nOpening Asiyst login in your browser...");
    if (!(await openBrowser(challenge.webLoginUrl))) {
      console.log("Browser could not be opened automatically.");
      console.log(`Open:\n${challenge.webLoginUrl}`);
    }
    console.log("Waiting for authorization...");
    const deadline = challenge.expiresAt && !Number.isNaN(Date.parse(challenge.expiresAt))
      ? Date.parse(challenge.expiresAt)
      : Date.now() + 5 * 60_000;
    let callback: BrowserCallback | undefined;
    let approved = false;
    const callbackPromise = callbackServer.waitForCallback();
    for (;;) {
      if (Date.now() >= deadline) throw new ApiError("Your Asiyst login session has expired. Please run /login again.", 401, "SESSION_EXPIRED");
      const result = await pollLoginChallenge(api, challenge.challengeId);
      if (result.status === "pending") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      if (result.status === "cancelled") throw new ApiError("✕ CLI login cancelled.", 400, "CONFLICT");
      if (result.status === "expired") throw new ApiError("✕ Login request expired.\n\nRun:\n  /login", 401, "SESSION_EXPIRED");
      if (result.status === "invalid" || result.status === "consumed") {
        throw new ApiError("✕ Asiyst authentication request is no longer valid.", 400, "CONFLICT");
      }
      if (result.status === "approved") {
        if (!approved) {
          approved = true;
          console.log("✓ Browser authorization approved.");
        }
      }
      if (!callback) {
        const next = await Promise.race([
          callbackPromise,
          new Promise<undefined>((resolve) => setTimeout(resolve, 1500)),
        ]);
        if (next) callback = next;
      }
      if (approved && callback) {
        if (callback.browserSessionId !== challenge.browserSessionId) {
          throw new ApiError("✕ Login failed.\nThe browser session does not match this login attempt.", 400, "CONFLICT");
        }
        console.log("✓ Authorization callback received.");
        console.log("⠋ Completing CLI authentication...");
        let consumed;
        try {
          consumed = await consumeLoginChallenge(api, challenge.challengeId, callback, callbackServer.redirectUri);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409 && error.message.includes("still pending")) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          throw error;
        }
        // The consume response is the backend-authenticated session. Approval alone is not sufficient.
        const session: OnboardingSession = {
          sessionId: consumed.sessionId,
          refreshToken: consumed.refreshToken,
          userId: consumed.userId,
          accountEmail: consumed.accountEmail,
          expiresAt: consumed.expiresAt,
        };
        if (!session.userId) {
          throw new ApiError(
            "CLI authentication succeeded but Asiyst did not return a User ID.",
            200,
            "MALFORMED_RESPONSE",
          );
        }
        console.log("⠋ Establishing CLI session...");
        try {
          await saveOnboardingSession(session);
          const stored = await loadOnboardingSession();
          if (!stored || stored.sessionId !== session.sessionId || stored.userId !== session.userId) {
            throw new Error("Session was not persisted.");
          }
        } catch {
          await clearOnboardingSession();
          throw new ApiError(
            "✕ CLI session could not be stored.\n\nPlease try /login again.",
            undefined,
            "INTERNAL_ERROR",
          );
        }
        console.log("✓ CLI session established.");
        console.log("✓ Logged in successfully.");
        if (session.accountEmail) console.log(`\nAccount:\n${session.accountEmail}`);
        console.log("\nYou can now use /connect, /status, /test, /validate, /deploy, /publish, and /knowledge.");
        return;
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "NOT_FOUND") {
        throw new ApiError("✕ Web authentication endpoint unavailable.", error.status, error.code);
      }
      if (error.code === "SESSION_EXPIRED") {
        throw new ApiError("✕ Login session expired.\n\nRun:\n  /login", error.status, error.code);
      }
      if (error.code === "FORBIDDEN") {
        throw new ApiError("✕ Login failed.", error.status, error.code);
      }
      if (error.code === "CONFLICT") {
        throw new ApiError(`✕ ${error.message}`, error.status, error.code);
      }
      if (error.code === "TIMEOUT") {
        throw new ApiError(`✕ ${error.message}`, error.status, error.code);
      }
      if (error.code === "NETWORK") {
        throw new ApiError("✕ Unable to connect to Asiyst.", error.status, "NETWORK");
      }
      throw error;
    }
    throw new ApiError("Unable to connect to Asiyst.", undefined, "NETWORK");
  } finally {
    await callbackServer.close();
  }
  } finally {
    loginInProgress = false;
  }
}
