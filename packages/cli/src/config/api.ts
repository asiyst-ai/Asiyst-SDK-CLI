export const PRODUCTION_API_ORIGIN = "https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api";
export const CLI_API_BASE_URL = PRODUCTION_API_ORIGIN;
export const VERIFY_KEY_PATH = "/v1/auth/verify-key";
export const VERIFY_KEY_URL = `${CLI_API_BASE_URL}${VERIFY_KEY_PATH}`;
export const ASIIYST_WEB_URL = "https://asiyst.com";
export const REQUEST_TIMEOUT_MS = 15_000;

function isLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return /localhost|127\.0\.0\.1|::1/i.test(value);
  }
}

export function resolveApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.ASIIYST_API_URL?.trim();
  const development = env.ASIIYST_API_MODE === "development";
  if (explicit && development) {
    if (isLocalUrl(explicit)) {
      return CLI_API_BASE_URL;
    }
    return explicit.replace(/\/+$/, "");
  }
  return CLI_API_BASE_URL;
}

export function isDebugEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ASIIYST_DEBUG === "1" || env.ASIIYST_DEBUG === "true";
}
