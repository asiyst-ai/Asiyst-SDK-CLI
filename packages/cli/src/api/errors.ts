export type ApiErrorCode =
  | "INVALID_API_KEY"
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
  if (bodyCode === "INVALID_API_KEY") return "INVALID_API_KEY";
  if (bodyCode === "API_KEY_REVOKED") return "API_KEY_REVOKED";
  if (bodyCode === "FORBIDDEN") return "FORBIDDEN";
  if (bodyCode === "PROJECT_NOT_FOUND") return "PROJECT_NOT_FOUND";
  if (bodyCode === "RATE_LIMITED") return "RATE_LIMITED";
  if (bodyCode === "INTERNAL_ERROR") return "INTERNAL_ERROR";
  if (status === 401) return "INVALID_API_KEY";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400 || status === 422) return "INVALID_REQUEST";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN";
}

export function friendlyApiMessage(error: ApiError, endpointUrl?: string): string {
  if (error.code === "INVALID_API_KEY") return "✗ Invalid API key.";
  if (error.code === "API_KEY_REVOKED") {
    return "✗ This API key has been revoked.\nCreate a new key from:\nhttps://asiyst.com";
  }
  if (error.code === "FORBIDDEN") {
    return "✗ This API key does not have permission to access this resource.";
  }
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
  if (error.code === "INTERNAL_ERROR") return "✗ Asiyst is temporarily unavailable.";
  return "✗ Asiyst request failed.";
}
