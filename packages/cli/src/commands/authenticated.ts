import { clearOnboardingSession, loadOnboardingSession } from "../config/credentials.js";
import type { OnboardingSession } from "../types.js";

export async function getAuthenticatedSession(): Promise<OnboardingSession | undefined> {
  const session = await loadOnboardingSession();
  const expiresAt = session?.expiresAt
    ? /^\d+$/.test(session.expiresAt)
      ? Number(session.expiresAt) * (session.expiresAt.length <= 10 ? 1000 : 1)
      : Date.parse(session.expiresAt)
    : undefined;
  if (expiresAt !== undefined && !Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
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
