import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectDocument } from "../src/dom/inspect";
import { TargetResolver } from "../src/dom/TargetResolver";
import { TargetNotFoundError } from "../src/errors";
import { WebsiteMap } from "../src/website-map/WebsiteMap";

const visibleRect = {
  x: 8,
  y: 8,
  width: 64,
  height: 24,
  top: 8,
  left: 8,
  right: 72,
  bottom: 32,
  toJSON() {},
} as DOMRect;

// jsdom reports 0x0 rectangles for synthetic elements. Visibility checks require a non-zero box,
// so tests stub getBoundingClientRect rather than relying on layout.

describe("target resolution", () => {
  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = () => visibleRect;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves developer-defined data-asiyst ids", () => {
    document.body.innerHTML = `<button data-asiyst="pricing">Pricing</button>`;
    const map = new WebsiteMap();
    map.replace(inspectDocument(document));
    const resolver = new TargetResolver(document, () => ({}), () => map.list());
    const result = resolver.resolve("pricing", "developer");
    expect(result.mapped.developerDefined).toBe(true);
    expect(result.element.textContent).toContain("Pricing");
  });

  it("coexists with automatic detection of buttons and links", () => {
    document.body.innerHTML = `
      <nav aria-label="Main">
        <a href="/products">Products</a>
      </nav>
      <button data-asiyst="checkout" data-asiyst-description="Proceed to checkout">Checkout</button>
    `;
    const elements = inspectDocument(document);
    expect(elements.some((el) => el.id === "checkout" && el.description === "Proceed to checkout")).toBe(true);
    expect(elements.some((el) => el.kind === "link" && el.text === "Products")).toBe(true);
    expect(elements.some((el) => el.kind === "navigation")).toBe(true);
  });

  it("does not execute cloud-provided selectors unless they are configured", () => {
    document.body.innerHTML = `<button id="secret">Hidden</button>`;
    const resolver = new TargetResolver(document, () => ({ search: "#q" }), () => []);
    expect(resolver.tryResolve({ selector: "#secret" }, "cloud")).toBeNull();

    document.body.innerHTML = `<input id="q" />`;
    const allowed = new TargetResolver(document, () => ({ search: "#q" }), () => []);
    expect(allowed.resolve({ id: "search" }, "cloud").element.id).toBe("q");
  });

  it("throws when the target is missing or not interactable", () => {
    document.body.innerHTML = `<button data-asiyst="gone" hidden>Gone</button>`;
    const map = new WebsiteMap();
    map.replace(inspectDocument(document));
    const resolver = new TargetResolver(document, () => ({}), () => map.list());
    expect(() => resolver.resolve("missing", "local")).toThrow(TargetNotFoundError);
    expect(() => resolver.resolve("gone", "local")).toThrow(TargetNotFoundError);
  });

  it("matches visible text when an id is not available", () => {
    document.body.innerHTML = `<button>Apply coupon</button>`;
    const map = new WebsiteMap();
    map.replace(inspectDocument(document));
    const resolver = new TargetResolver(document, () => ({}), () => map.list());
    const result = resolver.resolve({ text: "Apply coupon", role: "button" }, "local");
    expect(result.element.textContent).toContain("Apply coupon");
  });

  it("omits query strings from website map snapshots", () => {
    const map = new WebsiteMap();
    map.replace([]);
    const snapshot = map.snapshot(document);
    expect(snapshot.pageUrl.includes("?")).toBe(false);
  });
});
