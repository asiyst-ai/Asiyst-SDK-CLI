import type { HighlightStyle, ProjectConfig, TargetInput, TargetSource } from "../types";
import { TargetResolver } from "../dom/TargetResolver";
import { EventBus } from "../events/EventBus";
import { HighlightLayer } from "../highlighting/HighlightLayer";
import { MovementEngine } from "../movement/MovementEngine";
import { CssAvatarRenderer } from "./CssAvatarRenderer";
import { renderSafeText } from "../security/sanitize";

export class AvatarController {
  constructor(
    private readonly renderer: CssAvatarRenderer,
    private readonly movement: MovementEngine,
    private readonly highlights: HighlightLayer,
    private readonly resolver: TargetResolver,
    private readonly events: EventBus,
    private readonly liveRegion: HTMLElement,
    private readonly getConfig: () => ProjectConfig,
  ) {}

  show(): void {
    this.renderer.setHidden(false);
    this.movement.goToAnchor();
    this.events.emit("asiyst:avatar:shown", { name: this.getConfig().avatarName });
  }

  hide(): void {
    this.renderer.setHidden(true);
    this.highlights.hide();
    this.events.emit("asiyst:avatar:hidden", { name: this.getConfig().avatarName });
  }

  async moveTo(target: TargetInput, source: TargetSource = "developer"): Promise<void> {
    await this.movement.moveTo(target, source);
  }

  async pointAt(target: TargetInput, source: TargetSource = "developer"): Promise<void> {
    await this.movement.pointAt(target, source);
  }

  async highlight(
    target: TargetInput,
    style: HighlightStyle = "outline",
    source: TargetSource = "developer",
  ): Promise<string> {
    const resolved = this.resolver.resolve(target, source);
    await this.movement.moveTo(target, source);
    this.highlights.show(resolved.element, style);
    this.events.emit("asiyst:target:highlighted", {
      elementId: resolved.mapped.id,
      style,
    });
    return resolved.mapped.id;
  }

  speak(message: string): void {
    const text = message.trim();
    this.renderer.setSpeech(text || null);
    this.renderer.setPose("speak");
    renderSafeText(this.liveRegion, text);
  }

  think(): void {
    this.renderer.setPose("think");
  }

  celebrate(): void {
    this.renderer.setPose("celebrate");
  }

  setPosition(x: number, y: number): void {
    this.movement.setPosition(x, y, true);
  }

  applyConfig(config: ProjectConfig): void {
    this.renderer.applyConfig(config);
  }

  getFigure(): HTMLElement | undefined {
    return this.renderer.getFigure();
  }
}
