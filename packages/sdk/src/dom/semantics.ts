import type { ElementKind } from "../types";

const SEARCH_HINT = /search|query|find/i;

export function classifyElement(el: Element): ElementKind {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  const asiystId = el.getAttribute("data-asiyst") ?? "";

  if (asiystId === "search" || SEARCH_HINT.test(asiystId) || type === "search") {
    return "search";
  }
  if (tag === "dialog" || role === "dialog" || role === "alertdialog") {
    return "dialog";
  }
  if (tag === "nav" || role === "navigation") {
    return "navigation";
  }
  if (tag === "form") {
    return "form";
  }
  if (tag === "select") {
    return "select";
  }
  if (tag === "textarea") {
    return "textarea";
  }
  if (tag === "input") {
    return "input";
  }
  if (tag === "a") {
    return "link";
  }
  if (tag === "button" || role === "button" || type === "button" || type === "submit") {
    return "button";
  }
  if (role === "tab") {
    return "tab";
  }
  if (role === "menu" || role === "menubar") {
    return "menu";
  }
  if (/^h[1-6]$/.test(tag)) {
    return "heading";
  }
  if (el.getAttribute("data-asiyst-kind") === "card" || /\bcard\b/i.test(el.className)) {
    return "card";
  }
  if (tag === "header" || tag === "main" || tag === "footer" || tag === "section" || tag === "aside") {
    return "section";
  }
  return "other";
}

export function accessibleLabel(el: Element): string {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy && el.ownerDocument) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter((text): text is string => Boolean(text));
    if (labels.length > 0) {
      return labels.join(" ");
    }
  }
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    (el as HTMLInputElement).placeholder ||
    ""
  ).trim();
}

export function visibleText(el: Element, max = 240): string {
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return text.slice(0, max);
}

export function isDisabled(el: Element): boolean {
  return (
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    (el instanceof HTMLInputElement && el.disabled)
  );
}

export function isSkippable(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "noscript" || tag === "link" || tag === "meta") {
    return true;
  }
  if (el.id === "asiyst-host" || el.closest("#asiyst-host")) {
    return true;
  }
  return false;
}
