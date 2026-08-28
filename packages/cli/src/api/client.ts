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
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
      });
    } catch (error) {
      throw new ApiError(`Unable to reach Asiyst API at ${this.baseUrl}${path}. Check your internet connection, DNS, TLS/HTTPS, or whether the service is unavailable.`);
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail = response.status === 401 ? "Authentication is required." :
        response.status === 403 ? "The request is not authorized." :
          response.status === 404 ? "The requested resource was not found." :
            response.status === 409 ? "The request conflicts with the current project state." :
              response.status === 429 ? "Too many requests; try again shortly." :
                response.status >= 500 ? "Asiyst is temporarily unavailable." : "The request was rejected.";
      throw new ApiError(`Asiyst API returned HTTP ${response.status}. ${detail}`, response.status);
    }
    return body as T;
  }

  health(): Promise<{ status?: string }> {
    return this.request("/health");
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
