import { AuthenticationError, NetworkError } from "../errors";
import { SDK_VERSION } from "../core/constants";
import type { SdkEnvironment } from "../installation/types";

export const RUNTIME_AUDIENCE = "asiyst-sdk-runtime";
export const RUNTIME_CAPABILITIES = [
  "assistant:config",
  "assistant:conversation",
  "assistant:telemetry",
  "assistant:heartbeat",
] as const;

export type RuntimeCapability = (typeof RUNTIME_CAPABILITIES)[number];

interface RuntimeTokenResponse {
  token: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
  audience: typeof RUNTIME_AUDIENCE;
  capabilities: RuntimeCapability[];
}

interface RuntimeTokenEnvelope {
  success?: boolean;
  data?: Partial<RuntimeTokenResponse>;
}

interface RuntimeToken {
  value: string;
  expiresAt: number;
  capabilities: ReadonlySet<RuntimeCapability>;
}

export interface RuntimeAuthOptions {
  apiBaseUrl: string;
  projectId: string;
  publicKey: string;
  installationId: string;
  origin: string;
  environment: SdkEnvironment;
}

export class RuntimeAuth {
  private token: RuntimeToken | undefined;
  private requestInFlight: Promise<RuntimeToken> | undefined;

  constructor(private readonly options: RuntimeAuthOptions) {}

  async getToken(capability: RuntimeCapability): Promise<string> {
    if (this.token && this.isUsable(this.token) && this.token.capabilities.has(capability)) {
      return this.token.value;
    }
    if (!this.requestInFlight) {
      this.requestInFlight = this.issueToken().finally(() => {
        this.requestInFlight = undefined;
      });
    }
    const token = await this.requestInFlight;
    if (!token.capabilities.has(capability)) {
      throw new AuthenticationError("ASIYST runtime authorization does not allow this operation.");
    }
    return token.value;
  }

  invalidate(): void {
    this.token = undefined;
  }

  private isUsable(token: RuntimeToken): boolean {
    return token.expiresAt - Date.now() > 30_000;
  }

  private async issueToken(): Promise<RuntimeToken> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(`${this.options.apiBaseUrl.replace(/\/$/, "")}/sdk/runtime/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: this.options.projectId,
          publicKey: this.options.publicKey,
          installationId: this.options.installationId,
          origin: this.options.origin,
          environment: this.options.environment,
          sdkVersion: SDK_VERSION,
          capabilities: [...RUNTIME_CAPABILITIES],
        }),
        signal: controller.signal,
      });
    } catch {
      throw new NetworkError("ASIYST runtime authentication is unavailable.");
    } finally {
      clearTimeout(timeout);
    }

    let body: RuntimeTokenEnvelope | undefined;
    try {
      body = await response.json() as RuntimeTokenEnvelope;
    } catch {
      body = undefined;
    }
    if (!response.ok) {
      if (response.status === 403) {
        throw new AuthenticationError("ASIYST runtime authorization was rejected.");
      }
      if (response.status === 429) {
        throw new NetworkError("ASIYST runtime authentication is rate limited.");
      }
      throw new NetworkError("ASIYST runtime authentication is unavailable.");
    }

    const data = body?.data;
    if (
      !data
      || body?.success !== true
      || typeof data.token !== "string"
      || data.token.length < 20
      || data.tokenType !== "Bearer"
      || data.audience !== RUNTIME_AUDIENCE
      || typeof data.expiresIn !== "number"
      || !Number.isFinite(data.expiresIn)
      || data.expiresIn <= 0
      || typeof data.expiresAt !== "string"
      || !Array.isArray(data.capabilities)
      || data.capabilities.some((capability) => !RUNTIME_CAPABILITIES.includes(capability as RuntimeCapability))
    ) {
      throw new AuthenticationError("ASIYST returned an invalid runtime authorization response.");
    }

    const expiresAt = Date.parse(data.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new AuthenticationError("ASIYST runtime authorization has expired.");
    }
    const token: RuntimeToken = {
      value: data.token,
      expiresAt,
      capabilities: new Set(data.capabilities),
    };
    this.token = token;
    return token;
  }
}
