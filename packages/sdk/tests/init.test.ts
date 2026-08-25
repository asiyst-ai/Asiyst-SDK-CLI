import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Asiyst } from "../src/client/Asiyst";
import { InitializationError } from "../src/errors";
import { prefersReducedMotion } from "../src/accessibility/a11y";

describe("initialization", () => {
  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, width: 40, height: 40, top: 0, left: 0, right: 40, bottom: 40, toJSON() {} }) as DOMRect;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({}),
      }),
    );
  });

  afterEach(async () => {
    await Asiyst.destroy();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("initializes with fallback config when Cloud is unavailable", async () => {
    await Asiyst.init({ projectId: "proj_1", publicKey: "pk_test" });
    expect(Asiyst.getConfig().avatarName).toBe("Asiyst");
    expect(Asiyst.getConfig().mode).toBe("guided");
    expect(document.getElementById("asiyst-host")).toBeTruthy();
    expect(document.getElementById("asiyst-host")?.shadowRoot).toBeTruthy();
  });

  it("rejects a second init until destroy", async () => {
    await Asiyst.init({ projectId: "proj_1", publicKey: "pk_test" });
    await expect(Asiyst.init({ projectId: "proj_2", publicKey: "pk_other" })).rejects.toBeInstanceOf(
      InitializationError,
    );
  });

  it("isolates the host root from the page", async () => {
    await Asiyst.init({ projectId: "proj_1", publicKey: "pk_test" });
    const host = document.getElementById("asiyst-host");
    expect(host?.getAttribute("data-asiyst-root")).toBe("true");
  });
});

describe("accessibility", () => {
  it("detects reduced motion from matchMedia", () => {
    const win = {
      matchMedia: (query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        onchange: null,
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      }),
    };
    expect(prefersReducedMotion(win)).toBe(true);
  });
});
