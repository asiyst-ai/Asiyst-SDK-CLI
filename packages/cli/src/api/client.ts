import { CLI_API_BASE_URL, REQUEST_TIMEOUT_MS, isDebugEnabled, resolveApiBaseUrl } from "../config/api.js";
import { ApiError, errorCodeFromStatus } from "./errors.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function bodyErrorCode(body: unknown): string | undefined {
  const record = asRecord(body);
  const code = record?.code ?? record?.errorCode ?? asRecord(record?.error)?.code;
  return typeof code === "string" ? code : undefined;
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
      const code = errorCodeFromStatus(response.status, bodyErrorCode(body));
      if (code === "API_KEY_REVOKED" || bodyErrorCode(body) === "API_KEY_REVOKED") {
        throw new ApiError("This API key has been revoked.", response.status, "API_KEY_REVOKED");
      }
      throw new ApiError(`Asiyst API returned HTTP ${response.status}.`, response.status, code);
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
