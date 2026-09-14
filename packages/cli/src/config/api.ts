export const PRODUCTION_API_ORIGIN = "https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api";
export const CLI_API_BASE_URL = PRODUCTION_API_ORIGIN;
export const VERIFY_KEY_PATH = "/verify/api-key";
export const VERIFY_KEY_URL = `${CLI_API_BASE_URL}${VERIFY_KEY_PATH}`;
export const SDK_VERIFY_URL = `${CLI_API_BASE_URL}/cli/sdk/verify`;
export const ASIYST_WEB_URL = "https://asiyst.com";
export const ASIIYST_WEB_URL = ASIYST_WEB_URL;
export const ASIYST_REGISTER_URL = `${ASIYST_WEB_URL}/register`;
export const ASIYST_LOGIN_URL = `${ASIYST_WEB_URL}/login`;
export const ASIYST_PROJECT_NEW_URL = "/project/new";
export const ASIYST_DASHBOARD_URLS = {
  profile: `${ASIYST_WEB_URL}/dashboard/profile`,
  projects: `${ASIYST_WEB_URL}/dashboard/projects`,
  apiKeys: `${ASIYST_WEB_URL}/dashboard/api-keys`,
  connectSite: `${ASIYST_WEB_URL}/dashboard/connect-site`,
  avatarStudio: `${ASIYST_WEB_URL}/dashboard/avatar-studio`,
  knowledge: `${ASIYST_WEB_URL}/dashboard/knowledge`,
  sdkInstall: `${ASIYST_WEB_URL}/dashboard/sdk-install`,
} as const;
export const REQUEST_TIMEOUT_MS = 15_000;

function readEnv(env: NodeJS.ProcessEnv, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return /localhost|127\.0\.0\.1|::1/i.test(value);
  }
}

export function resolveApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = readEnv(env, "ASIYST_API_URL", "ASIIYST_API_URL");
  const development = readEnv(env, "ASIYST_API_MODE", "ASIIYST_API_MODE") === "development";
  if (explicit) {
    if (isLocalUrl(explicit)) {
      return CLI_API_BASE_URL;
    }
    return explicit.replace(/\/+$/, "");
  }
  if (development) {
    return CLI_API_BASE_URL;
  }
  return CLI_API_BASE_URL;
}

export function isDebugEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readEnv(env, "ASIYST_DEBUG", "ASIIYST_DEBUG") === "1" || readEnv(env, "ASIYST_DEBUG", "ASIIYST_DEBUG") === "true";
}
