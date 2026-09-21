import { describe, expect, it } from "vitest";
import { fallbackConfig, normalizeProjectConfig, validateInitOptions } from "../src/config/schema";
import { SDK_VERSION } from "../src/core/constants";
import { canNavigateTo, isActionAllowed, validateWebsiteDomain } from "../src/interaction/permissions";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("configuration", () => {
  it("keeps SDK_VERSION aligned with package.json", () => {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it("rejects missing or obviously wrong project IDs", () => {
    expect(() => validateInitOptions({})).toThrow(/projectId is required/i);
    expect(() => validateInitOptions({ projectId: "", publicKey: "k1" })).toThrow(/projectId is required/i);
    expect(() => validateInitOptions({ projectId: "67af7387-cb93-47c9-accc-a66381baf619", publicKey: "k1" })).toThrow(/Project ID/i);
  });

  it("trims credentials and accepts a public project ID", () => {
    const validProjectId = "K8mP2xQ7_vL4N9cR5T1zB6Y3";
    expect(validateInitOptions({ projectId: ` ${validProjectId} `, publicKey: " k1 " })).toEqual({
      projectId: validProjectId,
      publicKey: "k1",
    });
  });

  it("accepts dashboard-generated public project IDs and public SDK keys", () => {
    expect(validateInitOptions({
      projectId: "public_project_7f3a",
      publicKey: "public_sdk_key_abc123",
    })).toEqual({
      projectId: "public_project_7f3a",
      publicKey: "public_sdk_key_abc123",
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

  it("enforces server permissions for actions and navigation", () => {
    const config = normalizeProjectConfig({
      allowedActions: ["navigate", "highlight", "open", "scroll"],
      allowedDomains: ["caszio.com"],
      allowedRoutes: ["/products/*"],
      blockedRoutes: ["/admin/*", "/internal/*"],
      rules: [
        { action: "navigate", allowed: false },
        { action: "highlight", allowed: true },
        { action: "open", allowed: true },
      ],
    });

    expect(isActionAllowed("navigate", config, "cloud", "https://caszio.com/products/1")).toBe(false);
    expect(isActionAllowed("highlight", config, "cloud", "https://caszio.com/products/1")).toBe(true);
    expect(isActionAllowed("open", config, "cloud", "https://caszio.com/products/1")).toBe(true);
    expect(canNavigateTo(config, "/admin/users", "https://caszio.com")).toMatchObject({
      allowed: false,
      reason: "ROUTE_BLOCKED",
    });
    expect(canNavigateTo(config, "javascript:alert(1)", "https://caszio.com")).toMatchObject({
      allowed: false,
      reason: "ACTION_NOT_PERMITTED",
    });
  });

  it("blocks unauthorized domains and ignores malformed rules", () => {
    const config = normalizeProjectConfig({
      allowedDomains: ["caszio.com"],
      rules: [
        { action: "bad-action", allowed: false },
        { action: "highlight", allowed: "yes" },
        { action: "navigate", allowed: true, routes: ["/products/*"], domains: ["caszio.com"] },
      ],
    });

    expect(config.rules).toHaveLength(1);
    expect(config.rules[0]).toMatchObject({ action: "navigate", allowed: true });
    expect(validateWebsiteDomain(config, "https://evil.example")).toMatchObject({
      allowed: false,
      reason: "DOMAIN_NOT_AUTHORIZED",
    });
    expect(validateWebsiteDomain(config, "https://caszio.com/products/42")).toMatchObject({
      allowed: true,
    });
  });

  it("normalizes www prefixes and paths when checking the current website", () => {
    const config = normalizeProjectConfig({ allowedDomains: ["https://example.com/path"] });
    expect(validateWebsiteDomain(config, "https://www.example.com/shop")).toMatchObject({ allowed: true });
  });
});
