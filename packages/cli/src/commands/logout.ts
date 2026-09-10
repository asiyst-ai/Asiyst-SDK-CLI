import { clearOnboardingSession, loadOnboardingSession } from "../config/credentials.js";

export async function logoutCommand(): Promise<void> {
  const session = await loadOnboardingSession();
  if (!session) {
    console.log("You are not currently logged in.");
    return;
  }
  await clearOnboardingSession();
  console.log("✓ Logged out successfully");
}
