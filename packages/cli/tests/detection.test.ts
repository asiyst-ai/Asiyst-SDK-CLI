import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { detectEnvironment, detectFramework, detectProject, displayFramework, resolveApplicationEntryPoint } from "../src/detection/project.js";

describe("project detection", () => {
  it("detects SDK and Next.js", () => {
    const dir = mkdtempSync(join(tmpdir(), "asiyst-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { next: "^15", "@asiyst/sdk": "^1.2.0" } }));
    mkdirSync(join(dir, "node_modules", "@asiyst", "sdk"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "@asiyst", "sdk", "package.json"), JSON.stringify({ version: "1.2.0" }));
    const project = detectProject(dir);
    expect(project.sdkVersion).toBe("1.2.0");
    expect(project.framework).toBe("Next.js");
  });
  it("detects vanilla JavaScript when package.json has no framework", () => {
    const dir = mkdtempSync(join(tmpdir(), "asiyst-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "site" }));
    expect(detectFramework(dir, { name: "site" })).toBe("Vanilla JavaScript");
  });
  it("reports unknown projects when no package.json is present", () => expect(detectFramework("C:\\missing", null)).toBe("Unknown"));
  it("resolves a TanStack Start root entry point", () => {
    const dir = mkdtempSync(join(tmpdir(), "asiyst-tanstack-"));
    mkdirSync(join(dir, "src", "routes"), { recursive: true });
    writeFileSync(join(dir, "src", "routes", "__root.tsx"), "export default function Root() { return <Outlet />; }");
    expect(resolveApplicationEntryPoint(dir, "tanstack_start_ts", "TypeScript")).toMatchObject({
      entryPoint: "src/routes/__root.tsx",
      strategy: "root-client-integration",
    });
  });
  it("keeps framework metadata separate from user-facing project and environment values", () => {
    expect(displayFramework("tanstack_start_ts")).toBe("TanStack Start");
    expect(detectEnvironment({})).toBe("Unknown");
    expect(detectEnvironment({ NODE_ENV: "development" })).toBe("Development");
    expect(detectEnvironment({ ASIIYST_ENVIRONMENT: "production", NODE_ENV: "development" })).toBe("Production");
  });
});
