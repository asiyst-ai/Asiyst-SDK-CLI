import { describe, expect, it, vi } from "vitest";
import { checkForUpdate, compareVersions, isCiEnvironment, shouldCheckForUpdate, updateAndRestart } from "../src/update/check.js";

describe("CLI update check", () => {
  it("compares stable and prerelease semantic versions", () => {
    expect(compareVersions("0.2.2", "0.2.1")).toBe(1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBe(1);
  });
  it("reads the latest registry version", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ version: "0.2.2" }), { status: 200 }));
    await expect(checkForUpdate("0.2.1", fetcher)).resolves.toEqual({ currentVersion: "0.2.1", latestVersion: "0.2.2" });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("registry.npmjs.org"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it("fails open when npm is unavailable", async () => {
    const fetcher = vi.fn(async () => { throw new Error("offline"); });
    await expect(checkForUpdate("0.2.1", fetcher)).resolves.toEqual({ currentVersion: "0.2.1" });
  });
  it("skips CI and non-interactive sessions", () => {
    expect(isCiEnvironment({ CI: "true" })).toBe(true);
    expect(shouldCheckForUpdate({ CI: "true" }, true)).toBe(false);
    expect(shouldCheckForUpdate({}, false)).toBe(false);
  });
  it("restarts once with the updated package and guard flag", () => {
    const runner = vi.fn();
    expect(updateAndRestart("0.2.2", ["status"], { PATH: "test" }, runner)).toBe(true);
    expect(runner).toHaveBeenCalledWith("npx.cmd", ["--yes", "@asiyst/cli@0.2.2", "status"], expect.objectContaining({
      env: expect.objectContaining({ ASIIYST_UPDATE_ATTEMPTED: "1" }),
    }));
  });
});
