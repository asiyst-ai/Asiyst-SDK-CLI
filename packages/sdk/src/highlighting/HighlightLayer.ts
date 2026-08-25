import type { HighlightStyle } from "../types";
import { VIEWPORT_HANDLER_THROTTLE_MS } from "../core/constants";
import { throttle } from "../utils/timing";

const STYLE_TEXT = `
.asiyst-highlight-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.asiyst-dim { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.45); }
.asiyst-box {
  position: absolute;
  border-radius: 10px;
  box-sizing: border-box;
  transition: top 80ms linear, left 80ms linear, width 80ms linear, height 80ms linear;
}
.asiyst-outline { border: 2px solid #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25); }
.asiyst-glow { box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.35), 0 0 24px rgba(56, 189, 248, 0.55); }
.asiyst-pulse { border: 2px solid #38bdf8; animation: asiyst-pulse 1.4s ease-in-out infinite; }
.asiyst-spotlight {
  box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.55);
  border: 2px solid #f8fafc;
}
.asiyst-pointer::after {
  content: "";
  position: absolute;
  left: 50%;
  top: -18px;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background: #38bdf8;
}
@keyframes asiyst-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.55); }
  50% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .asiyst-box, .asiyst-pulse { animation: none; transition: none; }
}
`;

export class HighlightLayer {
  private box: HTMLDivElement | undefined;
  private dim: HTMLDivElement | undefined;
  private target: Element | undefined;
  private readonly onViewport: ReturnType<typeof throttle>;

  constructor(
    private readonly root: HTMLElement,
    private readonly win: Window,
  ) {
    const style = root.ownerDocument.createElement("style");
    style.textContent = STYLE_TEXT;
    root.appendChild(style);
    this.onViewport = throttle(() => this.sync(), VIEWPORT_HANDLER_THROTTLE_MS);
  }

  start(): void {
    this.win.addEventListener("scroll", this.onViewport, true);
    this.win.addEventListener("resize", this.onViewport);
  }

  show(target: Element, style: HighlightStyle): void {
    this.target = target;
    if (!this.box) {
      this.box = this.root.ownerDocument.createElement("div");
      this.box.className = "asiyst-box";
      this.root.appendChild(this.box);
    }
    this.box.className = `asiyst-box asiyst-${style === "dim" ? "outline" : style}`;
    if (style === "dim" || style === "spotlight") {
      if (!this.dim) {
        this.dim = this.root.ownerDocument.createElement("div");
        this.dim.className = "asiyst-dim";
        this.root.insertBefore(this.dim, this.box);
      }
      this.dim.style.display = style === "dim" ? "block" : "none";
    } else if (this.dim) {
      this.dim.style.display = "none";
    }
    this.sync();
  }

  hide(): void {
    this.target = undefined;
    if (this.box) {
      this.box.style.display = "none";
    }
    if (this.dim) {
      this.dim.style.display = "none";
    }
  }

  isShowing(): boolean {
    return Boolean(this.target);
  }

  stop(): void {
    this.hide();
    this.win.removeEventListener("scroll", this.onViewport, true);
    this.win.removeEventListener("resize", this.onViewport);
    this.onViewport.cancel();
  }

  private sync(): void {
    if (!this.box || !this.target) {
      return;
    }
    const rect = this.target.getBoundingClientRect();
    this.box.style.display = "block";
    this.box.style.left = `${rect.left - 4}px`;
    this.box.style.top = `${rect.top - 4}px`;
    this.box.style.width = `${rect.width + 8}px`;
    this.box.style.height = `${rect.height + 8}px`;
  }
}
