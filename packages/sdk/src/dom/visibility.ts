export function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  if (el.hidden || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) {
    return true;
  }
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function toViewportRect(el: Element): { x: number; y: number; width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}
