export const WEB_LIFECYCLE_CONTRACT = {
  endpoint: "/api/v1/events",
  status: "unsupported",
  supportedAnalytics: [
    "visitor",
    "page_view",
    "avatar_impression",
    "avatar_opened",
    "conversation_started",
    "question_asked",
    "assistant_response",
    "guidance_started",
    "guidance_completed",
    "guidance_abandoned",
    "cta_interaction",
    "task_completed",
    "sdk_initialized",
    "performance",
    "website_connection",
  ],
  supportedLifecycleNames: [],
  runtimeCapability: "assistant:telemetry",
  projectBindingRequired: true,
  verifiedInstallationRequired: true,
  browserOriginRequired: true,
  rateLimitRequired: true,
  note: "Lifecycle names prefixed with sdk. or cli. are not dispatched to the current web telemetry endpoint.",
} as const;

export type SupportedAnalyticsName = (typeof WEB_LIFECYCLE_CONTRACT.supportedAnalytics)[number];

export type SdkLifecycleName =
  | "sdk.connected"
  | "sdk.disconnected"
  | "sdk.verification_started"
  | "sdk.verification_failed"
  | "sdk.verified"
  | "sdk.version_outdated";

export type CliLifecycleName =
  | "cli.connected"
  | "cli.authentication_failed"
  | "cli.disconnected"
  | "cli.version_outdated";

export type LifecycleName = SdkLifecycleName | CliLifecycleName;

export type LifecyclePayload = Record<string, string | number | boolean | undefined>;
type SanitizedLifecyclePayload = Record<string, string | number | boolean>;
export type LifecycleContract = Omit<typeof WEB_LIFECYCLE_CONTRACT, "supportedAnalytics" | "supportedLifecycleNames"> & {
  supportedAnalytics: readonly string[];
  supportedLifecycleNames: readonly string[];
  supported: boolean;
};

export interface LifecycleEvent<Name extends LifecycleName = LifecycleName> {
  name: Name;
  timestamp: string;
  source: "sdk" | "cli";
  payload: LifecyclePayload;
  contract: LifecycleContract;
}

export interface LifecycleSink {
  readonly contract: LifecycleContract;
  emit<T extends LifecycleName>(event: LifecycleEvent<T>): void;
}

export class UnsupportedLifecycleSink implements LifecycleSink {
  readonly contract = {
    ...WEB_LIFECYCLE_CONTRACT,
    supportedLifecycleNames: [],
    supported: false,
  } as const;

  emit(): void {
    // In this repo, lifecycle names are internal-only and never sent to the web analytics endpoint.
  }
}

function sanitizePayload(value: LifecyclePayload): SanitizedLifecyclePayload {
  const next: SanitizedLifecyclePayload = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") continue;
    if (typeof entry === "string" && !entry.trim()) continue;
    const normalized = key.toLowerCase();
    if (/(token|secret|cookie|session|api.?key|refresh.?token|authorization|password|bearer)/i.test(normalized)) {
      continue;
    }
    next[key] = entry;
  }
  return next;
}

function sortablePayload(value: LifecyclePayload): SanitizedLifecyclePayload {
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .sort(([left],[right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function dedupeKey(name: LifecycleName, value: LifecyclePayload): string {
  return `${name}:${JSON.stringify(sortablePayload(value))}`;
}

export class LifecycleEmitter {
  private readonly seen = new Set<string>();

  constructor(private readonly sink: LifecycleSink = new UnsupportedLifecycleSink()) {}

  emit<Name extends LifecycleName>(name: Name, payload: LifecyclePayload = {}, options: { force?: boolean } = {}): LifecycleEvent<Name> | undefined {
    const sanitized = sanitizePayload(payload);
    const key = dedupeKey(name, sanitized);
    if (!options.force && this.seen.has(key)) {
      return undefined;
    }
    this.seen.add(key);
    const event: LifecycleEvent<Name> = {
      name,
      timestamp: new Date().toISOString(),
      source: name.startsWith("cli.") ? "cli" : "sdk",
      payload: sanitized,
      contract: {
        ...this.sink.contract,
        supportedLifecycleNames: [...this.sink.contract.supportedLifecycleNames],
        supported: false,
      },
    };
    try {
      this.sink.emit(event);
    } catch {
      // Lifecycle telemetry is secondary to the SDK/CLI operation.
    }
    return event;
  }

  clear(): void {
    this.seen.clear();
  }
}

export function createSdkLifecycleEmitter(sink?: LifecycleSink): LifecycleEmitter {
  return new LifecycleEmitter(sink ?? new UnsupportedLifecycleSink());
}

export function createCliLifecycleEmitter(sink?: LifecycleSink): LifecycleEmitter {
  return new LifecycleEmitter(sink ?? new UnsupportedLifecycleSink());
}

export function getLifecycleContractMetadata(): typeof WEB_LIFECYCLE_CONTRACT {
  return WEB_LIFECYCLE_CONTRACT;
}
