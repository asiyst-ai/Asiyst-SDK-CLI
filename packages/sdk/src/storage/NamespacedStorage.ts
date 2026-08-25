import { STORAGE_PREFIX } from "../core/constants";

export class NamespacedStorage {
  constructor(
    private readonly projectId: string,
    private readonly store: Storage | null,
  ) {}

  private key(suffix: string): string {
    return `${STORAGE_PREFIX}:${this.projectId}:${suffix}`;
  }

  read(suffix: string): string | null {
    if (!this.store) {
      return null;
    }
    try {
      return this.store.getItem(this.key(suffix));
    } catch {
      return null;
    }
  }

  write(suffix: string, value: string): void {
    if (!this.store) {
      return;
    }
    try {
      this.store.setItem(this.key(suffix), value);
    } catch {
      // Quota or private-mode failures must not break the host.
    }
  }

  remove(suffix: string): void {
    if (!this.store) {
      return;
    }
    try {
      this.store.removeItem(this.key(suffix));
    } catch {
      // ignore
    }
  }
}

export function browserLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
