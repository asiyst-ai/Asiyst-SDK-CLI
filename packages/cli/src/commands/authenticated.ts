import { clearOnboardingSession, loadOnboardingSession } from "../config/credentials.js";
import type { OnboardingSession } from "../types.js";

export async function getAuthenticatedSession(): Promise<OnboardingSession | undefined> {
  const session = await loadOnboardingSession();
  if (session?.expiresAt && !Number.isNaN(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt) <= Date.now()) {
    await clearOnboardingSession();
    return undefined;
  }
  return session;
}

export async function requireAuthenticatedSession(): Promise<OnboardingSession | undefined> {
  const session = await getAuthenticatedSession();
  if (session) return session;
  console.log("Session expired or not logged in.\n\nRun:\n  /login");
  return undefined;
}

export async function requireAuthenticated(): Promise<boolean> {
  return Boolean(await requireAuthenticatedSession());
}
