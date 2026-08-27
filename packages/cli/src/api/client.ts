import type { CliSession, SafeProjectInfo, SessionState, VerificationResult } from "../types.js";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  readonly baseUrl: string;
  constructor(baseUrl = process.env.ASIIYST_API_URL || "https://asiyst.com", private readonly fetcher: typeof fetch = fetch) {
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
      throw new ApiError(`Unable to reach Asiyst API: ${error instanceof Error ? error.message : "network error"}`);
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new ApiError(`Asiyst API returned HTTP ${response.status}`, response.status);
    return body as T;
  }

  createSession(): Promise<CliSession> {
    return this.request<unknown>("/api/cli/sessions", { method: "POST", body: JSON.stringify({}) }).then((value) => {
      if (!value || typeof value !== "object") throw new ApiError("Asiyst returned an invalid session response");
      const session = value as Record<string, unknown>;
      if (typeof session.sessionId !== "string" || typeof session.connectUrl !== "string" || typeof session.expiresAt !== "string") {
        throw new ApiError("Asiyst returned an invalid session response");
      }
      const url = new URL(session.connectUrl);
      const localApi = this.baseUrl.startsWith("http://localhost") || this.baseUrl.startsWith("http://127.0.0.1");
      if (url.protocol !== "https:" && !(localApi && url.protocol === "http:")) {
        throw new ApiError("Asiyst returned an insecure connection URL");
      }
      return { sessionId: session.sessionId, connectUrl: url.toString(), expiresAt: session.expiresAt };
    });
  }

  sessionStatus(sessionId: string): Promise<{ state: SessionState; project?: SafeProjectInfo }> {
    return this.request(`/api/cli/sessions/${encodeURIComponent(sessionId)}/status`);
  }

  projectInfo(projectId: string): Promise<SafeProjectInfo> {
    return this.request(`/api/cli/projects/${encodeURIComponent(projectId)}`);
  }

  verify(projectId: string, publicKey: string, domain?: string): Promise<VerificationResult[]> {
    return this.request<unknown>("/api/cli/verification", {
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
