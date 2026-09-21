import { browserLocalStorage, NamespacedStorage } from "../storage/NamespacedStorage";

const INSTALLATION_KEY = "installation_id";
const INSTALLATION_ID_PATTERN = /^inst_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const memoryIds = new Map<string, string>();

function randomInstallationId(): string | undefined {
  try {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function") {
      return `inst_${cryptoApi.randomUUID()}`;
    }
    if (typeof cryptoApi?.getRandomValues === "function") {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      return `inst_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function loadOrCreateInstallationId(projectId: string): string | undefined {
  const inMemory = memoryIds.get(projectId);
  if (inMemory) return inMemory;
  const storage = new NamespacedStorage(projectId, browserLocalStorage());
  const existing = storage.read(INSTALLATION_KEY)?.trim();
  if (existing && INSTALLATION_ID_PATTERN.test(existing)) {
    memoryIds.set(projectId, existing);
    return existing;
  }
  const installationId = randomInstallationId();
  if (!installationId) return undefined;
  memoryIds.set(projectId, installationId);
  storage.write(INSTALLATION_KEY, installationId);
  return installationId;
}
