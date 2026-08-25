import type { MappedElement } from "../types";
import { DATA_ATTR, DATA_ATTR_DESCRIPTION, HOST_ELEMENT_ID, WEBSITE_MAP_TEXT_LIMIT } from "../core/constants";
import { accessibleLabel, classifyElement, isDisabled, isSkippable, visibleText } from "./semantics";
import { isElementVisible, toViewportRect } from "./visibility";

const CANDIDATE_SELECTOR = [
  `[${DATA_ATTR}]`,
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "form",
  "nav",
  "h1",
  "h2",
  "h3",
  "[role='button']",
  "[role='link']",
  "[role='navigation']",
  "[role='dialog']",
  "[role='tab']",
  "[role='menu']",
  "[role='search']",
].join(",");

function sectionName(el: Element): string | null {
  const section = el.closest("header, nav, main, footer, aside, section, [data-asiyst-section]");
  if (!section) {
    return null;
  }
  return (
    section.getAttribute("data-asiyst-section") ||
    section.getAttribute("aria-label") ||
    section.tagName.toLowerCase()
  );
}

function elementId(el: Element, index: number): string {
  const explicit = el.getAttribute(DATA_ATTR);
  if (explicit) {
    return explicit;
  }
  const attrId = el.getAttribute("id");
  if (attrId) {
    return `dom:${attrId}`;
  }
  return `auto:${el.tagName.toLowerCase()}:${index}`;
}

export function inspectDocument(doc: Document): MappedElement[] {
  const pageUrl = doc.location?.href ?? "";
  const nodes = Array.from(doc.querySelectorAll(CANDIDATE_SELECTOR));
  const results: MappedElement[] = [];
  const seen = new Set<Element>();

  nodes.forEach((el, index) => {
    if (seen.has(el) || isSkippable(el) || el.closest(`#${HOST_ELEMENT_ID}`)) {
      return;
    }
    seen.add(el);
    const kind = classifyElement(el);
    const developerDefined = el.hasAttribute(DATA_ATTR);
    if (kind === "other" && !developerDefined) {
      return;
    }
    const text = visibleText(el, WEBSITE_MAP_TEXT_LIMIT);
    const label = accessibleLabel(el).slice(0, WEBSITE_MAP_TEXT_LIMIT);
    results.push({
      id: elementId(el, index),
      kind,
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      text,
      label,
      href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
      pageUrl,
      rect: toViewportRect(el),
      visible: isElementVisible(el),
      enabled: !isDisabled(el),
      developerDefined,
      description: el.getAttribute(DATA_ATTR_DESCRIPTION),
      section: sectionName(el),
    });
  });

  return results;
}

export function findElementByAsiystId(doc: Document, id: string): Element | null {
  return doc.querySelector(`[${DATA_ATTR}="${cssEscape(id)}"]`);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}
