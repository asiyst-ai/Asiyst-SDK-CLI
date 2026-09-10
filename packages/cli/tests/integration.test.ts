import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { detectProject } from "../src/detection/project.js";
import { applyIntegration, inspectIntegration, planIntegration, readIntegrationValues } from "../src/integration/writer.js";

const values = {
  projectId: "proj_caszio",
  publicKey: "pk_caszio_public",
  avatarId: "CASZIO1234",
};

function reactProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), "asiyst-integration-"));
  writeFileSync(join(cwd, "package.json"), JSON.stringify({
    dependencies: { react: "^18", "@asiyst/sdk": "^0.1.8" },
  }));
  writeFileSync(join(cwd, "src-main-placeholder"), "");
  return cwd;
}

describe("SDK integration writer", () => {
  it("creates one component and adds it to a React entry point", () => {
    const cwd = reactProject();
    mkdirSync(join(cwd, "src"), { recursive: true });
    writeFileSync(join(cwd, "src", "main.tsx"), [
      'import React from "react";',
      'import ReactDOM from "react-dom/client";',
      'import App from "./App";',
      'ReactDOM.createRoot(document.getElementById("root")!).render(<App />);',
      "",
    ].join("\n"));
    const plan = planIntegration(detectProject(cwd), values);
    const result = applyIntegration(detectProject(cwd), values, plan);
    expect(result.componentAction).toBe("create");
    expect(existsSync(join(cwd, "src", "components", "AsiystAssistant.tsx"))).toBe(true);
    const entry = readFileSync(join(cwd, "src", "main.tsx"), "utf8");
    expect(entry.match(/AsiystAssistant/g)?.length).toBe(3);
  });

  it("updates a managed integration without creating a duplicate component", () => {
    const cwd = reactProject();
    mkdirSync(join(cwd, "src"), { recursive: true });
    writeFileSync(join(cwd, "src", "main.tsx"), 'import App from "./App";\nReactDOM.createRoot(root).render(<App />);\n');
    const first = applyIntegration(detectProject(cwd), values);
    const nextValues = { ...values, avatarId: "NEWAVATAR1" };
    const second = applyIntegration(detectProject(cwd), nextValues);
    expect(first.componentAction).toBe("create");
    expect(second.componentAction).toBe("update");
    expect(readIntegrationValues(planIntegration(detectProject(cwd), nextValues)).avatarId).toBe("NEWAVATAR1");
  });

  it("detects initialization in an existing application entry point", () => {
    const cwd = reactProject();
    mkdirSync(join(cwd, "src"), { recursive: true });
    writeFileSync(join(cwd, "src", "main.tsx"), [
      'import { Asiyst } from "@asiyst/sdk";',
      'void Asiyst.init({ projectId: "proj_caszio", publicKey: "pk_caszio_public", avatarId: "CASZIO1234" });',
      "",
    ].join("\n"));
    expect(inspectIntegration(detectProject(cwd))).toMatchObject({
      sdkInstalled: true,
      initialized: true,
      projectId: "proj_caszio",
      publicKey: "pk_caszio_public",
      avatarId: "CASZIO1234",
    });
  });
});
