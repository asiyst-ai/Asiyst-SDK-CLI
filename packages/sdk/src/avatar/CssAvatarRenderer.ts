import type { ProjectConfig } from "../types";
import { renderSafeText } from "../security/sanitize";
import type { AvatarPose, AvatarRenderer } from "../movement/MovementEngine";

const AVATAR_CSS = `
.asiyst-avatar {
  position: fixed;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
  user-select: none;
}
.asiyst-avatar.asiyst-animate {
  transition: left 420ms cubic-bezier(0.22, 1, 0.36, 1), top 420ms cubic-bezier(0.22, 1, 0.36, 1);
}
.asiyst-figure {
  border-radius: 28px;
  display: grid;
  place-items: center;
  color: #fff;
  font: 700 14px/1.2 system-ui, sans-serif;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.28);
}
.asiyst-figure[data-pose="point"] { transform: rotate(-12deg); }
.asiyst-figure[data-pose="think"] { opacity: 0.85; }
.asiyst-figure[data-pose="celebrate"] { transform: scale(1.08); }
.asiyst-bubble {
  max-width: 220px;
  background: #0f172a;
  color: #f8fafc;
  border-radius: 12px;
  padding: 8px 10px;
  font: 13px/1.4 system-ui, sans-serif;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
}
.asiyst-name { font: 600 12px/1 system-ui, sans-serif; color: #0f172a; }
@media (prefers-reduced-motion: reduce) {
  .asiyst-avatar.asiyst-animate { transition: none; }
}
`;

export class CssAvatarRenderer implements AvatarRenderer {
  private root: HTMLElement | undefined;
  private figure: HTMLButtonElement | undefined;
  private bubble: HTMLElement | undefined;
  private nameEl: HTMLElement | undefined;
  private size = 96;
  private hidden = false;
  private facing: "left" | "right" = "right";
  private pose: AvatarPose = "idle";

  mount(container: HTMLElement, config: ProjectConfig): void {
    const doc = container.ownerDocument;
    const style = doc.createElement("style");
    style.textContent = AVATAR_CSS;
    container.appendChild(style);

    this.root = doc.createElement("div");
    this.root.className = "asiyst-avatar asiyst-animate";
    this.root.setAttribute("role", "img");

    this.figure = doc.createElement("button");
    this.figure.type = "button";
    this.figure.className = "asiyst-figure";
    this.figure.setAttribute("aria-label", `${config.avatarName} assistant`);

    this.nameEl = doc.createElement("div");
    this.nameEl.className = "asiyst-name";

    this.bubble = doc.createElement("div");
    this.bubble.className = "asiyst-bubble";
    this.bubble.hidden = true;

    this.root.append(this.bubble, this.figure, this.nameEl);
    container.appendChild(this.root);
    this.applyConfig(config);
  }

  unmount(): void {
    this.root?.remove();
    this.root = undefined;
  }

  applyConfig(config: ProjectConfig): void {
    this.size = config.size;
    if (this.figure) {
      this.figure.style.width = `${config.size}px`;
      this.figure.style.height = `${config.size}px`;
      this.figure.style.background = config.theme.accent ?? "#2563eb";
      renderSafeText(this.figure, config.avatarName.slice(0, 1).toUpperCase());
    }
    if (this.nameEl) {
      renderSafeText(this.nameEl, config.avatarName);
    }
    if (this.root) {
      this.root.setAttribute("aria-label", config.avatarName);
    }
  }

  setPosition(x: number, y: number, animate: boolean): void {
    if (!this.root) {
      return;
    }
    this.root.classList.toggle("asiyst-animate", animate);
    this.root.style.left = `${x}px`;
    this.root.style.top = `${y}px`;
  }

  setFacing(direction: "left" | "right"): void {
    this.facing = direction;
    this.syncTransform();
  }

  setPose(pose: AvatarPose): void {
    this.pose = pose;
    this.figure?.setAttribute("data-pose", pose);
    this.syncTransform();
  }

  private syncTransform(): void {
    if (!this.figure) {
      return;
    }
    const face = this.facing === "left" ? "scaleX(-1)" : "";
    const pose =
      this.pose === "point" ? "rotate(-12deg)" : this.pose === "celebrate" ? "scale(1.08)" : "";
    this.figure.style.transform = `${face} ${pose}`.trim();
  }

  setSpeech(text: string | null): void {
    if (!this.bubble) {
      return;
    }
    if (!text) {
      this.bubble.hidden = true;
      this.bubble.textContent = "";
      return;
    }
    this.bubble.hidden = false;
    renderSafeText(this.bubble, text);
  }

  getSize(): { width: number; height: number } {
    return { width: this.size, height: this.size + 28 };
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (this.root) {
      this.root.hidden = hidden;
    }
  }

  isHidden(): boolean {
    return this.hidden;
  }

  getFigure(): HTMLElement | undefined {
    return this.figure;
  }
}
