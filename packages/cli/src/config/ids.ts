export const PUBLIC_IDENTIFIER_PATTERN = /^(?=.{1,128}$)[A-Za-z0-9_][A-Za-z0-9_-]*$/;
export const PROJECT_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{23}$/;
export const API_KEY_PATTERN = /^(?:[A-Za-z0-9_-]{32}|as_[A-Za-z0-9_-]{16,256})$/;
export const USER_ID_PATTERN = /^[A-Za-z0-9-]{16}$/;
export const AVATAR_ID_PATTERN = /^[A-Za-z0-9]{10}$/;

export function isValidPublicIdentifier(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (trimmed === "undefined" || trimmed === "null") return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return false;
  }

  return PUBLIC_IDENTIFIER_PATTERN.test(trimmed);
}

export function isValidProjectId(value: unknown): value is string {
  return typeof value === "string" && PROJECT_ID_PATTERN.test(value.trim());
}

export function isValidApiKey(value: unknown): value is string {
  return typeof value === "string" && API_KEY_PATTERN.test(value.trim());
}

export function isValidUserId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() !== "undefined"
    && value.trim() !== "null"
    && USER_ID_PATTERN.test(value);
}

export function isValidAvatarId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "undefined" && value.trim() !== "null" && AVATAR_ID_PATTERN.test(value.trim());
}

export function parseProjectIdArgument(argv: string[] = []): string | undefined {
  const length = argv.length;
  for (let index = 0; index < length; index += 1) {
    const entry = argv[index];
    if (entry === "--project-id" || entry === "--projectId") {
      const next = argv[index + 1];
      return typeof next === "string" ? next : "";
    }
    if (entry.startsWith("--project-id=") || entry.startsWith("--projectId=")) {
      return entry.slice(entry.indexOf("=") + 1);
    }
  }
  return undefined;
}
