import type { MappedElement, TargetInput, TargetRef, TargetSource } from "../types";
import { TargetNotFoundError } from "../errors";
import { querySafeSelector } from "../security/selectors";
import { findElementByAsiystId } from "./inspect";
import { isDisabled } from "./semantics";
import { isElementVisible } from "./visibility";

export interface ResolveResult {
  element: Element;
  mapped: MappedElement;
}

function asRef(input: TargetInput): TargetRef {
  if (typeof input === "string") {
    return { id: input };
  }
  return input;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export class TargetResolver {
  constructor(
    private readonly doc: Document,
    private readonly configuredSelectors: () => Record<string, string>,
    private readonly mappedElements: () => MappedElement[],
  ) {}

  resolve(input: TargetInput, source: TargetSource): ResolveResult {
    const ref = asRef(input);
    const element = this.findElement(ref, source);
    if (!element || !isElementVisible(element) || isDisabled(element)) {
      throw new TargetNotFoundError("Target does not exist or is not interactable");
    }
    const mapped = this.mappedElements().find((item) => this.matchesMapped(item, element, ref));
    return {
      element,
      mapped: mapped ?? this.adHocMapped(element, ref),
    };
  }

  tryResolve(input: TargetInput, source: TargetSource): ResolveResult | null {
    try {
      return this.resolve(input, source);
    } catch {
      return null;
    }
  }

  private findElement(ref: TargetRef, source: TargetSource): Element | null {
    if (ref.id) {
      const byAttr = findElementByAsiystId(this.doc, ref.id);
      if (byAttr) {
        return byAttr;
      }
      const configured = this.configuredSelectors()[ref.id];
      if (configured) {
        const found = querySafeSelector(this.doc, configured);
        if (found) {
          return found;
        }
      }
      const mapped = this.mappedElements().find((item) => item.id === ref.id);
      if (mapped) {
        const byMapped = findElementByAsiystId(this.doc, mapped.id) ?? this.doc.getElementById(mapped.id.replace(/^dom:/, ""));
        if (byMapped) {
          return byMapped;
        }
      }
    }

    if (ref.selector && source === "developer") {
      return querySafeSelector(this.doc, ref.selector);
    }

    if (ref.selector && source === "cloud") {
      const allowed = Object.values(this.configuredSelectors());
      if (allowed.includes(ref.selector)) {
        return querySafeSelector(this.doc, ref.selector);
      }
      return null;
    }

    return this.matchBySemantics(ref);
  }

  private matchBySemantics(ref: TargetRef): Element | null {
    const wantedText = ref.text ? normalize(ref.text) : "";
    const wantedRole = ref.role ? normalize(ref.role) : "";
    let best: MappedElement | undefined;
    let bestScore = 0;

    for (const item of this.mappedElements()) {
      if (!item.visible || !item.enabled) {
        continue;
      }
      let score = 0;
      if (wantedRole && (normalize(item.role ?? "") === wantedRole || item.kind === wantedRole)) {
        score += 2;
      }
      const haystack = normalize(`${item.label} ${item.text} ${item.description ?? ""}`);
      if (wantedText && haystack.includes(wantedText)) {
        score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (!best || bestScore < 2) {
      return null;
    }
    return findElementByAsiystId(this.doc, best.id)
      ?? this.doc.querySelector(`[id="${best.id.replace(/^dom:/, "")}"]`)
      ?? this.findMappedElement(best);
  }

  private findMappedElement(mapped: MappedElement): Element | null {
    const candidates = Array.from(this.doc.querySelectorAll("a[href], button, input, select, textarea, form, nav, h1, h2, h3, [role]"));
    return candidates.find((element) => {
      if (!isElementVisible(element) || isDisabled(element)) return false;
      const text = normalize(`${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`);
      const wanted = normalize(`${mapped.label} ${mapped.text}`);
      const role = normalize(element.getAttribute("role") ?? "");
      return (wanted.length > 0 && (text.includes(wanted) || wanted.includes(text))) ||
        (mapped.role !== null && role === normalize(mapped.role));
    }) ?? null;
  }

  private matchesMapped(item: MappedElement, element: Element, ref: TargetRef): boolean {
    if (ref.id && item.id === ref.id) {
      return true;
    }
    return element.getAttribute("data-asiyst") === item.id;
  }

  private adHocMapped(element: Element, ref: TargetRef): MappedElement {
    return {
      id: ref.id ?? element.getAttribute("data-asiyst") ?? "unknown",
      kind: "other",
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute("role"),
      text: (element.textContent ?? "").trim().slice(0, 80),
      label: element.getAttribute("aria-label") ?? "",
      href: element.getAttribute("href"),
      pageUrl: this.doc.location?.href ?? "",
      rect: { x: 0, y: 0, width: 0, height: 0 },
      visible: true,
      enabled: true,
      developerDefined: element.hasAttribute("data-asiyst"),
      description: element.getAttribute("data-asiyst-description"),
      section: null,
    };
  }
}
