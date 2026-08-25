export function isolate<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export async function isolateAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export function withIsolation(fn: () => void): void {
  try {
    fn();
  } catch {
    // Host pages must keep running if Asiyst throws.
  }
}
