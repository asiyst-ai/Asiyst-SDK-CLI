import type { ProjectConfig } from "../types";
import { CONFIG_CACHE_TTL_MS, CONFIG_SCHEMA_VERSION } from "../core/constants";
import { NamespacedStorage } from "../storage/NamespacedStorage";
import { normalizeProjectConfig } from "./schema";

interface CachedEnvelope {
  schemaVersion: number;
  projectId: string;
  fetchedAt: number;
  config: ProjectConfig;
}

export class ConfigCache {
  constructor(private readonly storage: NamespacedStorage) {}

  read(projectId: string): ProjectConfig | null {
    const raw = this.storage.read("config");
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as CachedEnvelope;
      if (parsed.schemaVersion !== CONFIG_SCHEMA_VERSION || parsed.projectId !== projectId) {
        return null;
      }
      if (Date.now() - parsed.fetchedAt > CONFIG_CACHE_TTL_MS) {
        return null;
      }
      return normalizeProjectConfig(parsed.config);
    } catch {
      return null;
    }
  }

  write(projectId: string, config: ProjectConfig): void {
    const envelope: CachedEnvelope = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      projectId,
      fetchedAt: Date.now(),
      config,
    };
    this.storage.write("config", JSON.stringify(envelope));
  }
}
