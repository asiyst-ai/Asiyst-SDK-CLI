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

export type CliLifecycleName =
  | "cli.connected"
  | "cli.authentication_failed"
  | "cli.disconnected"
  | "cli.version_outdated";

export type LifecycleName = CliLifecycleName;

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
  source: "cli";
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
    // This CLI does not post sdk.* or cli.* lifecycle names to the web analytics contract.
  }
}

const shouldStripKey = (key: string): boolean => /(token|secret|cookie|session|api.?key|refresh.?token|authorization|password|bearer)/i.test(key);

function sanitizePayload(value: LifecyclePayload): SanitizedLifecyclePayload {
  const next: SanitizedLifecyclePayload = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") continue;
    if (typeof entry === "string" && !entry.trim()) continue;
    if (shouldStripKey(key)) continue;
    next[key] = entry;
  }
  return next;
}

function dedupeKey(name: LifecycleName, value: LifecyclePayload): string {
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `${name}:${JSON.stringify(Object.fromEntries(entries))}`;
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
      source: "cli",
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
      // Lifecycle telemetry is secondary to the CLI operation.
    }
    return event;
  }

  clear(): void {
    this.seen.clear();
  }
}

export function createCliLifecycleEmitter(sink?: LifecycleSink): LifecycleEmitter {
  return new LifecycleEmitter(sink ?? new UnsupportedLifecycleSink());
}

export function getLifecycleContractMetadata(): typeof WEB_LIFECYCLE_CONTRACT {
  return WEB_LIFECYCLE_CONTRACT;
}
