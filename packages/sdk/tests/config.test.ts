import { describe, expect, it } from "vitest";
import { fallbackConfig, normalizeProjectConfig, validateInitOptions } from "../src/config/schema";
import { ConfigurationError } from "../src/errors";
import { SDK_VERSION } from "../src/core/constants";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("configuration", () => {
  it("keeps SDK_VERSION aligned with package.json", () => {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it("rejects missing credentials", () => {
    expect(() => validateInitOptions({})).toThrow(ConfigurationError);
    expect(() => validateInitOptions({ projectId: "p" })).toThrow(/publicKey/);
  });

  it("trims credentials", () => {
    expect(validateInitOptions({ projectId: " p1 ", publicKey: " k1 " })).toEqual({
      projectId: "p1",
      publicKey: "k1",
    });
  });

  it("normalizes unknown remote payloads onto a safe schema", () => {
    const config = normalizeProjectConfig({
      avatarName: "Alex",
      size: 9000,
      position: "nope",
      allowedActions: ["click", "explode", "highlight"],
      mode: "assist",
      elementSelectors: {
        search: "#q",
        bad: "javascript:alert(1)",
      },
      personality: { tone: "calm", nested: { nope: true } },
    });

    expect(config.avatarName).toBe("Alex");
    expect(config.size).toBe(220);
    expect(config.position).toBe("bottom-right");
    expect(config.mode).toBe("assist");
    expect(config.allowedActions).toEqual(["click", "highlight"]);
    expect(config.elementSelectors).toEqual({ search: "#q" });
    expect(config.personality).toEqual({ tone: "calm" });
    expect(config.schemaVersion).toBe(fallbackConfig().schemaVersion);
  });

  it("falls back when the payload is not an object", () => {
    const config = normalizeProjectConfig(null);
    expect(config.avatarName).toBe("Asiyst");
    expect(config.allowedActions).toContain("highlight");
    expect(config.allowedActions).not.toContain("click");
  });
});
