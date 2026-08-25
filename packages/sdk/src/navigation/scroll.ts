import type { SafeInsets } from "../types";

export function estimateSafeInsets(doc: Document): SafeInsets {
  const insets: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const view = doc.defaultView;
  if (!view) {
    return insets;
  }

  const candidates = Array.from(doc.querySelectorAll("body *")).slice(0, 200);
  for (const el of candidates) {
    if (!(el instanceof HTMLElement) || el.id === "asiyst-host") {
      continue;
    }
    const style = view.getComputedStyle(el);
    const position = style.position;
    if (position !== "fixed" && position !== "sticky") {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) {
      continue;
    }
    if (rect.top <= 8 && rect.height < view.innerHeight / 3) {
      insets.top = Math.max(insets.top, Math.min(rect.bottom, 160));
    }
    if (rect.bottom >= view.innerHeight - 8 && rect.height < view.innerHeight / 3) {
      insets.bottom = Math.max(insets.bottom, Math.min(view.innerHeight - rect.top, 120));
    }
  }

  return insets;
}

export async function scrollWindowTo(
  win: Window,
  left: number,
  top: number,
  reducedMotion: boolean,
): Promise<void> {
  win.scrollTo({
    left,
    top,
    behavior: reducedMotion ? "auto" : "smooth",
  });
  if (!reducedMotion) {
    await waitForScrollIdle(win);
  }
}

function waitForScrollIdle(win: Window): Promise<void> {
  return new Promise((resolve) => {
    let last = win.scrollY;
    let stable = 0;
    const timer = win.setInterval(() => {
      if (Math.abs(win.scrollY - last) < 1) {
        stable += 1;
      } else {
        stable = 0;
        last = win.scrollY;
      }
      if (stable >= 3) {
        win.clearInterval(timer);
        resolve();
      }
    }, 50);
    win.setTimeout(() => {
      win.clearInterval(timer);
      resolve();
    }, 1200);
  });
}
