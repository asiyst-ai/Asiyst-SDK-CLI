import { CLI_API_BASE_URL, REQUEST_TIMEOUT_MS, isDebugEnabled, resolveApiBaseUrl } from "../config/api.js";
import { ApiError, errorCodeFromStatus } from "./errors.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function bodyErrorCode(body: unknown): string | undefined {
  const record = asRecord(body);
  const data = asRecord(record?.data);
  const error = asRecord(record?.error);
  const dataError = asRecord(data?.error);
  const code = record?.code ?? record?.errorCode ?? record?.error
    ?? data?.code ?? data?.errorCode ?? data?.error
    ?? dataError?.code
    ?? error?.code;
  return typeof code === "string" ? code.trim().toUpperCase() : undefined;
}

function bodyErrorMessage(body: unknown): string | undefined {
  const record = asRecord(body);
  const data = asRecord(record?.data);
  const message = record?.message
    ?? (typeof record?.error === "string" ? record.error : undefined)
    ?? asRecord(record?.error)?.message
    ?? data?.message
    ?? (typeof data?.error === "string" ? data.error : undefined)
    ?? asRecord(data?.error)?.message;
  return typeof message === "string" && message.trim() ? message.trim() : undefined;
}

function safeToken(value: string | null | undefined): string {
  if (!value) return "absent";
  const token = value.replace(/^Bearer\s+/i, "").trim();
  if (!token) return "absent";
  if (token.length <= 8) return `${token.slice(0, 2)}…(${token.length})`;
  return `${token.slice(0, 4)}…${token.slice(-4)} (${token.length})`;
}

function debugRequest(path: string, headers: Headers): void {
  if (!isDebugEnabled()) return;
  console.error(`[asiyst-debug] REQUEST ${path}`);
  console.error(`[asiyst-debug] Authorization: ${safeToken(headers.get("Authorization"))}`);
  console.error(`[asiyst-debug] X-Asiyst-Session: ${safeToken(headers.get("X-Asiyst-Session"))}`);
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "AbortError");
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl = resolveApiBaseUrl(), private readonly fetcher: typeof fetch = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    debugRequest(path, headers);
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...init,
        headers,
        signal: init?.signal || controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new ApiError("Connection to Asiyst timed out.", undefined, "TIMEOUT");
      }
      throw new ApiError("Unable to reach Asiyst API.", undefined, "NETWORK");
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await response.text();
    let body: unknown;
    if (rawText) {
      try {
        body = JSON.parse(rawText) as unknown;
      } catch {
        body = undefined;
      }
    }

    if (!response.ok) {
      const backendCode = bodyErrorCode(body);
      const code = errorCodeFromStatus(response.status, backendCode);
      if (isDebugEnabled()) {
        console.error(`[asiyst-debug] RESPONSE ${response.status} ${path}`);
        console.error(`[asiyst-debug] code: ${backendCode ?? "none"}`);
        console.error(`[asiyst-debug] message: ${bodyErrorMessage(body) ?? "none"}`);
      }
      if (code === "API_KEY_REVOKED" || bodyErrorCode(body) === "API_KEY_REVOKED") {
        throw new ApiError("This API key has been revoked.", response.status, "API_KEY_REVOKED");
      }
      const message = bodyErrorMessage(body) ?? `Asiyst API returned HTTP ${response.status}.`;
      throw new ApiError(backendCode ? `${message} (code: ${backendCode})` : message, response.status, code);
    }

    if (rawText && body === undefined) {
      if (isDebugEnabled()) {
        throw new ApiError("Asiyst API returned an invalid JSON response.", response.status, "MALFORMED_RESPONSE");
      }
      throw new ApiError("Received an unexpected response from Asiyst.", response.status, "MALFORMED_RESPONSE");
    }

    return (body === undefined ? {} : body) as T;
  }

  async health(): Promise<{ status?: string }> {
    try {
      const body = await this.request<unknown>("/health");
      const record = asRecord(body);
      if (record) return record as { status?: string };
    } catch {
      // The current production API contract exposes the health endpoint at the root of the API base URL.
    }
    throw new ApiError("Received an unexpected response from Asiyst.", 200, "MALFORMED_RESPONSE");
  }
}

export { ApiError, CLI_API_BASE_URL };
