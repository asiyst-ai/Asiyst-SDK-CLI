import type { CliSession, SafeProjectInfo, SessionState, VerificationResult } from "../types.js";
import { CLI_API_BASE_URL } from "../config/api.js";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  readonly baseUrl: string;
  constructor(baseUrl = process.env.ASIIYST_API_URL || CLI_API_BASE_URL, private readonly fetcher: typeof fetch = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        signal: init?.signal || controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
      });
    } catch (error) {
      if ((error instanceof DOMException && error.name === "AbortError") || (error instanceof Error && error.name === "AbortError")) {
        throw new ApiError(`Asiyst API request timed out after 10 seconds: ${this.baseUrl}${path}. Check your connection and try again.`);
      }
      throw new ApiError(`Unable to reach Asiyst API at ${this.baseUrl}${path}. Check your internet connection, DNS, TLS/HTTPS, or whether the service is unavailable.`);
    } finally {
      clearTimeout(timeout);
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail = response.status === 400 ? "The request data was invalid." :
        response.status === 401 ? "Authentication is required. Please connect your Asiyst account." :
        response.status === 403 ? "You are not authorized to perform this operation." :
          response.status === 404 ? `The API endpoint was not found: ${this.baseUrl}${path}. Please update Asiyst CLI or contact support.` :
            response.status === 409 ? "The request conflicts with the current project state." :
            response.status === 422 ? "The request data was invalid." :
              response.status === 429 ? "Too many requests; try again shortly." :
                response.status >= 500 ? "Asiyst is temporarily unavailable." : "The request was rejected.";
      throw new ApiError(`Asiyst API returned HTTP ${response.status}. ${detail}`, response.status);
    }
    if (body === undefined) {
      throw new ApiError(`Asiyst API returned an invalid JSON response (HTTP ${response.status}).`, response.status);
    }
    return body as T;
  }

  health(): Promise<{ status?: string }> {
    return this.request<unknown>("/health").then((body) => {
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new ApiError("Asiyst API health endpoint returned an invalid response.");
      }
      return body as { status?: string };
    });
  }

  createSession(): Promise<CliSession> {
    return this.request<unknown>("/cli/sessions", { method: "POST", body: JSON.stringify({}) }).then((value) => {
      if (!value || typeof value !== "object") throw new ApiError("Asiyst returned an invalid session response");
      const session = value as Record<string, unknown>;
      if (typeof session.sessionId !== "string" || typeof session.connectUrl !== "string" || typeof session.expiresAt !== "string") {
        throw new ApiError("Asiyst returned an invalid session response");
      }
      const url = new URL(session.connectUrl);
      if (url.protocol !== "https:") {
        throw new ApiError("Asiyst returned an insecure connection URL");
      }
      return { sessionId: session.sessionId, connectUrl: url.toString(), expiresAt: session.expiresAt };
    });
  }

  sessionStatus(sessionId: string): Promise<{ state: SessionState; project?: SafeProjectInfo }> {
    return this.request(`/cli/sessions/${encodeURIComponent(sessionId)}/status`);
  }

  projectInfo(projectId: string): Promise<SafeProjectInfo> {
    return this.request(`/cli/projects/${encodeURIComponent(projectId)}`);
  }

  verify(projectId: string, publicKey: string, domain?: string): Promise<VerificationResult[]> {
    return this.request<unknown>("/cli/verification", {
      method: "POST",
      body: JSON.stringify({ projectId, publicKey, domain }),
    }).then((value) => {
      if (!Array.isArray(value) || !value.every((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string" && typeof (item as Record<string, unknown>).ok === "boolean")) {
        throw new ApiError("Asiyst returned an invalid verification response");
      }
      return value as VerificationResult[];
    });
  }
}
