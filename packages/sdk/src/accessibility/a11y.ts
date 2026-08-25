export function prefersReducedMotion(windowLike: Pick<Window, "matchMedia"> | null): boolean {
  if (!windowLike || typeof windowLike.matchMedia !== "function") {
    return false;
  }
  try {
    return windowLike.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function createLiveRegion(root: ShadowRoot): HTMLElement {
  const region = root.ownerDocument.createElement("div");
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.style.position = "absolute";
  region.style.width = "1px";
  region.style.height = "1px";
  region.style.overflow = "hidden";
  region.style.clipPath = "inset(50%)";
  root.appendChild(region);
  return region;
}
