import type { InitOptions, ProjectConfig, TargetInput, TaskDefinition, WorkflowDefinition } from "../types";
import { DEFAULT_API_BASE_URL } from "./constants";
import { InitializationError } from "../errors";
import { EventBus } from "../events/EventBus";
import type { AsiystEventMap } from "../events/types";
import { HttpTransport } from "../communication/HttpTransport";
import { CloudClient } from "../communication/CloudClient";
import { ConfigManager } from "../config/ConfigManager";
import { Analytics } from "../analytics/Analytics";
import { HostRoot } from "./HostRoot";
import { inspectDocument } from "../dom/inspect";
import { DomObserver } from "../dom/DomObserver";
import { TargetResolver } from "../dom/TargetResolver";
import { WebsiteMap } from "../website-map/WebsiteMap";
import { HistoryObserver } from "../navigation/HistoryObserver";
import { HighlightLayer } from "../highlighting/HighlightLayer";
import { CssAvatarRenderer } from "../avatar/CssAvatarRenderer";
import { MovementEngine } from "../movement/MovementEngine";
import { AvatarController } from "../avatar/AvatarController";
import { InteractionEngine } from "../interaction/InteractionEngine";
import { TaskEngine } from "../task/TaskEngine";
import { WorkflowEngine } from "../workflow/WorkflowEngine";
import { ConversationPanel } from "../client/ConversationPanel";
import { createLiveRegion } from "../accessibility/a11y";
import { debounce } from "../utils/timing";
import { DOM_SCAN_DEBOUNCE_MS } from "./constants";
import { isolateAsync, withIsolation } from "./isolate";

export class AsiystRuntime {
  readonly events = new EventBus();
  private readonly options: InitOptions;
  private readonly cloud: CloudClient;
  private readonly config: ConfigManager;
  private readonly analytics: Analytics;
  private readonly host: HostRoot;
  private readonly map = new WebsiteMap();
  private readonly observer = new DomObserver(() => this.rescan());
  private readonly history: HistoryObserver;
  private readonly resolver: TargetResolver;
  private readonly avatar: AvatarController;
  private readonly movement: MovementEngine;
  private readonly highlights: HighlightLayer;
  private readonly tasks: TaskEngine;
  private readonly workflows: WorkflowEngine;
  private readonly panel: ConversationPanel;
  private readonly renderer: CssAvatarRenderer;
  private destroyed = false;
  private readonly rescanDebounced = debounce(() => this.rescan(), DOM_SCAN_DEBOUNCE_MS);

  constructor(options: InitOptions, doc: Document, win: Window) {
    if (!doc.body) {
      throw new InitializationError("document.body is not available");
    }
    this.options = options;
    const transport = new HttpTransport({
      apiBaseUrl: options.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      projectId: options.projectId,
      publicKey: options.publicKey,
    });
    this.cloud = new CloudClient(transport, options.projectId);
    this.config = new ConfigManager(options, this.cloud, this.events);
    this.analytics = new Analytics(options.projectId, this.cloud);
    this.host = new HostRoot(doc);
    this.resolver = new TargetResolver(
      doc,
      () => this.config.get().elementSelectors,
      () => this.map.list(),
    );
    this.renderer = new CssAvatarRenderer();
    this.renderer.mount(this.host.chrome, this.config.get());
    this.highlights = new HighlightLayer(this.host.overlay, win);
    this.movement = new MovementEngine(win, doc, this.renderer, this.resolver, this.events, () => this.config.get());
    const live = createLiveRegion(this.host.shadow);
    this.avatar = new AvatarController(
      this.renderer,
      this.movement,
      this.highlights,
      this.resolver,
      this.events,
      live,
      () => this.config.get(),
    );
    const interaction = new InteractionEngine(this.avatar, this.resolver, () => this.config.get(), win);
    this.tasks = new TaskEngine(interaction, this.events, this.analytics, this.cloud);
    this.workflows = new WorkflowEngine(this.cloud, this.tasks);
    this.panel = new ConversationPanel(
      this.host.chrome,
      (text) => this.handleUserMessage(text, doc),
      (open) => {
        if (open) {
          this.analytics.track("assistant_opened");
          this.events.emit("asiyst:conversation:started", { conversationId: this.panel.getConversationId() });
        } else {
          this.analytics.track("assistant_closed");
          this.events.emit("asiyst:conversation:closed", { conversationId: this.panel.getConversationId() });
        }
      },
    );
    this.history = new HistoryObserver(() => this.rescanDebounced());
    this.history.start(win, options.observeHistory !== false);
    this.observer.start(doc.documentElement);
    this.highlights.start();
    this.movement.start();
    this.analytics.start();
    this.rescan();
    this.avatar.show();
    this.renderer.getFigure()?.addEventListener("click", () => this.open());
    win.addEventListener("pagehide", () => {
      void this.analytics.flush();
    });
  }

  async start(): Promise<void> {
    this.events.emit("asiyst:initialized", { projectId: this.options.projectId });
    const cfg = await isolateAsync(() => this.config.refresh(), this.config.get());
    this.avatar.applyConfig(cfg);
    this.avatar.show();
    this.events.emit("asiyst:ready", { projectId: this.options.projectId, configVersion: cfg.version });
  }

  getConfig(): ProjectConfig {
    return this.config.get();
  }

  open(): void {
    this.panel.open();
    this.avatar.show();
  }

  close(): void {
    this.panel.close();
  }

  avatarApi() {
    return this.avatar;
  }

  async startTaskFromText(text: string, doc: Document): Promise<void> {
    this.analytics.track("question_started");
    const task = await this.cloud.requestTask(text, doc.location.href);
    const result = await this.tasks.run(task, "cloud");
    if (result === "task_completed") {
      this.analytics.track("question_completed");
    }
  }

  async startTask(task: TaskDefinition): Promise<void> {
    await this.tasks.run(task, "developer");
  }

  cancelTask(): void {
    this.tasks.cancel();
  }

  async startWorkflow(id: string): Promise<void> {
    await this.workflows.start(id, "cloud");
  }

  async startWorkflowDefinition(workflow: WorkflowDefinition): Promise<void> {
    await this.workflows.run(workflow, "developer");
  }

  on<K extends keyof AsiystEventMap>(event: K, handler: (payload: AsiystEventMap[K]) => void): () => void {
    return this.events.on(event, handler);
  }

  off<K extends keyof AsiystEventMap>(event: K, handler: (payload: AsiystEventMap[K]) => void): void {
    this.events.off(event, handler);
  }

  async destroy(win: Window): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.observer.stop();
    this.history.stop(win);
    this.movement.stop();
    this.highlights.stop();
    this.rescanDebounced.cancel();
    this.renderer.unmount();
    this.host.destroy();
    this.events.emit("asiyst:destroyed", { projectId: this.options.projectId });
    this.events.removeAll();
    await this.analytics.destroy();
  }

  private rescan(): void {
    withIsolation(() => {
      const doc = this.host.host.ownerDocument;
      this.map.replace(inspectDocument(doc));
      void this.cloud.sendWebsiteMap(this.map.snapshot(doc));
    });
  }

  private async handleUserMessage(text: string, doc: Document): Promise<void> {
    this.events.emit("asiyst:conversation:message", { role: "user", text });
    this.avatar.think();
    try {
      const reply = await this.cloud.sendConversationMessage(text, doc.location.href);
      this.panel.append("assistant", reply.message.text);
      this.avatar.speak(reply.message.text);
      this.events.emit("asiyst:conversation:message", { role: "assistant", text: reply.message.text });
      await this.startTaskFromText(text, doc);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asiyst Cloud is unavailable";
      this.panel.append("assistant", message);
      this.events.emit("asiyst:error", { code: "conversation_failed", message });
      this.avatar.speak(message);
    }
  }
}
