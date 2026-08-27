import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { detectFramework, detectProject } from "../src/detection/project.js";

describe("project detection", () => {
  it("detects SDK and Next.js", () => {
    const dir = mkdtempSync(join(tmpdir(), "asiyst-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { next: "^15", "@asiyst/sdk": "^1.2.0" } }));
    const project = detectProject(dir);
    expect(project.sdkVersion).toBe("^1.2.0");
    expect(project.framework).toBe("Next.js");
  });
  it("falls back to vanilla", () => expect(detectFramework("C:\\missing", null)).toBe("Vanilla JavaScript/TypeScript"));
});
