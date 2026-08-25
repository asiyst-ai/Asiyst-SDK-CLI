import { NetworkError } from "../errors";
import { SDK_VERSION } from "../core/constants";
import type { CloudRequest, CloudResponse, CloudTransport } from "./types";

export interface HttpTransportOptions {
  apiBaseUrl: string;
  projectId: string;
  publicKey: string;
}

export class HttpTransport implements CloudTransport {
  constructor(private readonly options: HttpTransportOptions) {}

  async request<T>(req: CloudRequest): Promise<CloudResponse<T>> {
    const url = `${this.options.apiBaseUrl.replace(/\/$/, "")}${req.path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: req.method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Asiyst-Project-Id": this.options.projectId,
          "X-Asiyst-Public-Key": this.options.publicKey,
          "X-Asiyst-SDK-Version": SDK_VERSION,
        },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: req.signal,
      });
    } catch {
      throw new NetworkError("Asiyst Cloud is unreachable");
    }

    let data: T | null = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        data = (await response.json()) as T;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      return { ok: false, status: response.status, data };
    }

    return { ok: true, status: response.status, data };
  }
}
