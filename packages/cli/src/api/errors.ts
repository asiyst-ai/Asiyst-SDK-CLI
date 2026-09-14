export type ApiErrorCode =
  | "INVALID_API_KEY"
  | "API_KEY_NOT_FOUND"
  | "API_KEY_EXPIRED"
  | "API_KEY_PROJECT_MISMATCH"
  | "API_KEY_USER_MISMATCH"
  | "API_KEY_REVOKED"
  | "FORBIDDEN"
  | "PROJECT_NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "NETWORK"
  | "MALFORMED_RESPONSE"
  | "CONFLICT"
  | "INVALID_REQUEST"
  | "INVALID_USER_ID"
  | "INVALID_PROJECT_ID"
  | "INVALID_AVATAR_ID"
  | "USER_MISMATCH"
  | "PROJECT_MISMATCH"
  | "SESSION_EXPIRED"
  | "AVATAR_NOT_FOUND"
  | "AVATAR_ALREADY_IMPORTED"
  | "AVATAR_MISMATCH"
  | "IMPORT_FAILED"
  | "HANDOFF_FAILED"
  | "SDK_NOT_ACTIVE"
  | "UNKNOWN";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code: ApiErrorCode = "UNKNOWN",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorCodeFromStatus(status: number, bodyCode?: string): ApiErrorCode {
  const code = bodyCode?.trim().toUpperCase();
  if (code === "INVALID_API_KEY" || code === "API_KEY_INVALID" || code === "INVALID_KEY") return "INVALID_API_KEY";
  if (code === "API_KEY_NOT_FOUND" || code === "KEY_NOT_FOUND") return "API_KEY_NOT_FOUND";
  if (code === "API_KEY_EXPIRED" || code === "KEY_EXPIRED") return "API_KEY_EXPIRED";
  if (code === "API_KEY_PROJECT_MISMATCH" || code === "KEY_PROJECT_MISMATCH" || code === "WRONG_PROJECT") return "API_KEY_PROJECT_MISMATCH";
  if (code === "API_KEY_USER_MISMATCH" || code === "KEY_USER_MISMATCH" || code === "WRONG_USER") return "API_KEY_USER_MISMATCH";
  if (code === "API_KEY_REVOKED") return "API_KEY_REVOKED";
  if (code === "FORBIDDEN") return "FORBIDDEN";
  if (code === "USER_MISMATCH") return "USER_MISMATCH";
  if (code === "PROJECT_MISMATCH") return "PROJECT_MISMATCH";
  if (code === "SESSION_EXPIRED") return "SESSION_EXPIRED";
  if (code === "UNAUTHORIZED" || code === "AUTHENTICATION_REQUIRED" || code === "AUTH_REQUIRED") {
    return "SESSION_EXPIRED";
  }
  if (code === "PROJECT_NOT_FOUND") return "PROJECT_NOT_FOUND";
  if (code === "AVATAR_NOT_FOUND") return "AVATAR_NOT_FOUND";
  if (code === "AVATAR_ALREADY_IMPORTED") return "AVATAR_ALREADY_IMPORTED";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "INTERNAL_ERROR") return "INTERNAL_ERROR";
  if (code === "SDK_NOT_ACTIVE") return "SDK_NOT_ACTIVE";
  if (status === 401) return "SESSION_EXPIRED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "INVALID_REQUEST";
  if (status === 409) return "CONFLICT";
  if (status === 400 || status === 422) return "INVALID_REQUEST";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN";
}

export function friendlyApiMessage(error: ApiError, endpointUrl?: string): string {
  if (error.code === "INVALID_API_KEY") return "✗ API key is invalid.";
  if (error.code === "API_KEY_NOT_FOUND") return "✗ API key was not found.";
  if (error.code === "API_KEY_EXPIRED") return "✗ API key has expired.";
  if (error.code === "API_KEY_PROJECT_MISMATCH") return "✗ API key does not belong to this project.";
  if (error.code === "API_KEY_USER_MISMATCH") return "✗ API key does not belong to this account.";
  if (error.code === "API_KEY_REVOKED") {
    return "✗ This API key has been revoked.\nCreate a new key from:\nhttps://asiyst.com";
  }
  if (error.code === "FORBIDDEN") {
    return "✗ This API key does not have permission to access this resource.";
  }
  if (error.code === "USER_MISMATCH") return "✗ The supplied identifiers do not belong to the verified user.";
  if (error.code === "PROJECT_MISMATCH") return "✗ The supplied identifiers do not belong to the verified project.";
  if (error.code === "SESSION_EXPIRED") return "Your Asiyst session has expired. Please reconnect your account.";
  if (error.code === "NOT_FOUND") {
    return endpointUrl
      ? `✗ Asiyst API endpoint was not found.\nVerify that the CLI is using:\n${endpointUrl}`
      : "✗ Asiyst API endpoint was not found.";
  }
  if (error.code === "TIMEOUT") return "Connection to Asiyst timed out.";
  if (error.code === "NETWORK") return "✗ Unable to reach Asiyst API.";
  if (error.code === "MALFORMED_RESPONSE") return "Received an unexpected response from Asiyst.";
  if (error.code === "RATE_LIMITED") return "✗ Too many requests. Try again shortly.";
  if (error.code === "PROJECT_NOT_FOUND") return "✗ Authorized project was not found.";
  if (error.code === "CONFLICT") return "✗ The request conflicts with the current project state.";
  if (error.code === "INVALID_REQUEST") return "✗ The request was invalid.";
  if (error.code === "AVATAR_NOT_FOUND") return "✗ Avatar was not found.";
  if (error.code === "AVATAR_ALREADY_IMPORTED") return "✗ This avatar is already imported into the project.";
  if (error.code === "INTERNAL_ERROR") return "✗ Asiyst is temporarily unavailable.";
  if (error.code === "HANDOFF_FAILED") return "✗ Unable to establish the Asiyst browser session.\n  Please retry /connect.";
  return "✗ Asiyst request failed.";
}
