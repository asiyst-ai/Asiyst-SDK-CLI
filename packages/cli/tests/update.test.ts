import { describe, expect, it, vi } from "vitest";
import { checkForUpdate, compareVersions, detectInstallKind, installLatest } from "../src/update/check.js";

describe("manual CLI updates", () => {
  it("compares semantic versions without downgrading", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBe(1);
  });
  it("fails open when npm is unavailable", async () => {
    const fetcher = vi.fn(async () => { throw new Error("offline"); });
    await expect(checkForUpdate("1.0.2", fetcher)).resolves.toEqual({ currentVersion: "1.0.2" });
  });
  it("detects npx and verifies a downloaded package", () => {
    expect(detectInstallKind("C:\\Users\\dev\\AppData\\Local\\npm-cache\\_npx\\x\\node_modules\\@asiyst\\cli\\dist\\index.js", {}, () => undefined)).toBe("npx");
    const runner = vi.fn(() => "1.0.3\n");
    expect(installLatest("1.0.3", "npx", "ignored", runner)).toBe("1.0.3");
    expect(runner).toHaveBeenCalledWith("npx.cmd", ["--yes", "@asiyst/cli@1.0.3", "--version"], { encoding: "utf8" });
  });
});
