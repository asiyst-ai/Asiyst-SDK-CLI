import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "../src/init";

describe("asiyst init", () => {
  it("requires package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "asiyst-cli-"));
    expect(() => runInit(dir)).toThrow(/package.json/);
  });

  it("writes a snippet and reports dashboard URL", () => {
    const dir = mkdtempSync(join(tmpdir(), "asiyst-cli-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "site", dependencies: {} }), "utf8");
    const result = runInit(dir, 1);
    expect(result.dashboardUrl).toBe("https://asiyst.com");
    const snippet = readFileSync(result.snippetPath, "utf8");
    expect(snippet).toContain("@asiyst/sdk");
    expect(snippet).toContain("projectId");
    expect(result.nextSteps.some((step) => step.includes("npm install"))).toBe(true);
  });
});
