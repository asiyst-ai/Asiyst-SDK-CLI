import type { ProjectConfig, Rect, TargetInput, TargetSource } from "../types";
import { prefersReducedMotion } from "../accessibility/a11y";
import { TargetResolver } from "../dom/TargetResolver";
import { EventBus } from "../events/EventBus";
import { estimateSafeInsets, scrollWindowTo } from "../navigation/scroll";
import { anchorToViewport, computeAvatarDestination } from "../utils/geometry";
import { VIEWPORT_HANDLER_THROTTLE_MS } from "../core/constants";
import { throttle } from "../utils/timing";

export type AvatarPose = "idle" | "point" | "think" | "celebrate" | "speak" | "walk";

export interface AvatarRenderer {
  mount(container: HTMLElement, config: ProjectConfig): void;
  unmount(): void;
  applyConfig(config: ProjectConfig): void;
  setPosition(x: number, y: number, animate: boolean): void;
  setFacing(direction: "left" | "right"): void;
  setPose(pose: AvatarPose): void;
  setSpeech(text: string | null): void;
  getSize(): { width: number; height: number };
}

export class MovementEngine {
  private x = 0;
  private y = 0;
  private readonly onViewport: ReturnType<typeof throttle>;
  private followTarget: Element | undefined;

  constructor(
    private readonly win: Window,
    private readonly doc: Document,
    private readonly renderer: AvatarRenderer,
    private readonly resolver: TargetResolver,
    private readonly events: EventBus,
    private readonly getConfig: () => ProjectConfig,
  ) {
    this.onViewport = throttle(() => {
      if (this.followTarget) {
        this.placeBeside(this.followTarget, false);
      }
    }, VIEWPORT_HANDLER_THROTTLE_MS);
  }

  start(): void {
    this.win.addEventListener("scroll", this.onViewport, true);
    this.win.addEventListener("resize", this.onViewport);
  }

  stop(): void {
    this.win.removeEventListener("scroll", this.onViewport, true);
    this.win.removeEventListener("resize", this.onViewport);
    this.onViewport.cancel();
  }

  goToAnchor(): void {
    const config = this.getConfig();
    const size = this.renderer.getSize();
    const viewport = this.viewport();
    const point = anchorToViewport(config.position, viewport, size, estimateSafeInsets(this.doc));
    this.setPosition(point.x, point.y, !prefersReducedMotion(this.win));
  }

  async moveTo(target: TargetInput, source: TargetSource): Promise<Rect> {
    const resolved = this.resolver.resolve(target, source);
    this.events.emit("asiyst:target:found", { target: typeof target === "string" ? { id: target } : target, elementId: resolved.mapped.id });
    await this.placeBeside(resolved.element, true);
    this.followTarget = resolved.element;
    return resolved.mapped.rect;
  }

  async pointAt(target: TargetInput, source: TargetSource): Promise<void> {
    await this.moveTo(target, source);
    this.renderer.setPose("point");
  }

  private async placeBeside(element: Element, mayScroll: boolean): Promise<void> {
    const reduced = prefersReducedMotion(this.win);
    const size = this.renderer.getSize();
    const viewport = this.viewport();
    const insets = estimateSafeInsets(this.doc);
    const rect = element.getBoundingClientRect();
    const plan = computeAvatarDestination({
      target: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      viewport,
      avatarSize: size,
      insets,
    });

    if (mayScroll && plan.needsScroll) {
      await scrollWindowTo(this.win, plan.scrollLeft, plan.scrollTop, reduced);
      return this.placeBeside(element, false);
    }

    this.renderer.setFacing(plan.facing);
    this.renderer.setPose("walk");
    this.setPosition(plan.avatarX, plan.avatarY, !reduced);
    this.renderer.setPose("idle");
  }

  setPosition(x: number, y: number, animate: boolean): void {
    this.x = x;
    this.y = y;
    this.renderer.setPosition(x, y, animate);
    this.events.emit("asiyst:avatar:moved", { x, y });
  }

  currentPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  private viewport() {
    return {
      width: this.win.innerWidth,
      height: this.win.innerHeight,
      scrollX: this.win.scrollX,
      scrollY: this.win.scrollY,
    };
  }
}
