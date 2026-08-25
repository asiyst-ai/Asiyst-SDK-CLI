import type { InitOptions, ProjectConfig } from "../types";
import { EventBus } from "../events/EventBus";
import { CloudClient } from "../communication/CloudClient";
import { browserLocalStorage, NamespacedStorage } from "../storage/NamespacedStorage";
import { ConfigCache } from "./ConfigCache";
import { fallbackConfig, normalizeProjectConfig, validateInitOptions } from "./schema";

export class ConfigManager {
  private current: ProjectConfig;
  private readonly cache: ConfigCache;

  constructor(
    private readonly options: InitOptions,
    private readonly cloud: CloudClient,
    private readonly events: EventBus,
  ) {
    const credentials = validateInitOptions(options);
    this.options = { ...options, ...credentials };
    this.cache = new ConfigCache(
      new NamespacedStorage(credentials.projectId, browserLocalStorage()),
    );
    const cached = this.cache.read(credentials.projectId);
    this.current = cached ?? this.localFallback();
  }

  get(): ProjectConfig {
    return this.current;
  }

  async refresh(): Promise<ProjectConfig> {
    try {
      const remote = await this.cloud.fetchConfig();
      this.current = normalizeProjectConfig(remote);
      this.cache.write(this.options.projectId, this.current);
      return this.current;
    } catch (error) {
      this.events.emit("asiyst:error", {
        code: "config_refresh_failed",
        message: error instanceof Error ? error.message : "Failed to refresh configuration",
      });
      return this.current;
    }
  }

  private localFallback(): ProjectConfig {
    const base = fallbackConfig();
    return {
      ...base,
      mode: this.options.mode ?? base.mode,
      allowedActions: this.options.allowedActions ?? base.allowedActions,
    };
  }
}
