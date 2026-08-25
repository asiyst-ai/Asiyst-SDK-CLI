import type { MappedElement, WebsiteMapSnapshot } from "../types";

export class WebsiteMap {
  private elements: MappedElement[] = [];

  replace(elements: MappedElement[]): void {
    this.elements = elements;
  }

  list(): MappedElement[] {
    return this.elements;
  }

  snapshot(doc: Document): WebsiteMapSnapshot {
    const url = new URL(doc.location?.href ?? "https://invalid.local/");
    url.search = "";
    url.hash = "";
    return {
      pageUrl: url.toString(),
      path: url.pathname,
      title: (doc.title ?? "").slice(0, 120),
      capturedAt: Date.now(),
      elements: this.elements
        .filter((el) => el.visible)
        .map((el) => ({
          ...el,
          href: el.href && !el.href.toLowerCase().startsWith("javascript:") ? el.href : null,
        })),
    };
  }
}
