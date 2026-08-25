import { renderSafeText, sanitizeText } from "../security/sanitize";

export class ConversationPanel {
  private readonly panel: HTMLElement;
  private readonly log: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly form: HTMLFormElement;
  private conversationId = "";
  private openState = false;

  constructor(
    root: HTMLElement,
    private readonly onSubmit: (text: string) => Promise<void>,
    private readonly onToggle: (open: boolean) => void,
  ) {
    const doc = root.ownerDocument;
    const style = doc.createElement("style");
    style.textContent = `
      .asiyst-panel {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: min(360px, calc(100vw - 32px));
        max-height: min(480px, 70vh);
        background: #fff;
        color: #0f172a;
        border-radius: 16px;
        box-shadow: 0 16px 50px rgba(15, 23, 42, 0.22);
        display: flex;
        flex-direction: column;
        font: 14px/1.45 system-ui, sans-serif;
        overflow: hidden;
      }
      .asiyst-panel[hidden] { display: none; }
      .asiyst-panel header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 14px;
        background: #0f172a;
        color: #f8fafc;
      }
      .asiyst-log { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      .asiyst-msg { padding: 8px 10px; border-radius: 10px; max-width: 90%; }
      .asiyst-msg[data-role="user"] { align-self: flex-end; background: #dbeafe; }
      .asiyst-msg[data-role="assistant"] { align-self: flex-start; background: #f1f5f9; }
      .asiyst-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; }
      .asiyst-form input { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; }
      .asiyst-form button, .asiyst-close {
        border: 0; border-radius: 8px; padding: 8px 10px; background: #2563eb; color: #fff; cursor: pointer;
      }
      .asiyst-close { background: transparent; color: #f8fafc; }
    `;
    root.appendChild(style);

    this.panel = doc.createElement("section");
    this.panel.className = "asiyst-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "false");
    this.panel.setAttribute("aria-label", "Asiyst assistant");

    const header = doc.createElement("header");
    const title = doc.createElement("strong");
    title.textContent = "Asiyst";
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "asiyst-close";
    close.textContent = "Close";
    close.addEventListener("click", () => this.close());
    header.append(title, close);

    this.log = doc.createElement("div");
    this.log.className = "asiyst-log";

    this.form = doc.createElement("form");
    this.form.className = "asiyst-form";
    this.input = doc.createElement("input");
    this.input.type = "text";
    this.input.setAttribute("aria-label", "Message Asiyst");
    this.input.autocomplete = "off";
    const send = doc.createElement("button");
    send.type = "submit";
    send.textContent = "Send";
    this.form.append(this.input, send);
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });

    this.panel.append(header, this.log, this.form);
    root.appendChild(this.panel);

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.openState) {
        this.close();
      }
    });
  }

  isOpen(): boolean {
    return this.openState;
  }

  getConversationId(): string {
    return this.conversationId;
  }

  open(): void {
    if (!this.conversationId) {
      this.conversationId = `conv_${Date.now().toString(36)}`;
    }
    this.openState = true;
    this.panel.hidden = false;
    this.input.focus();
    this.onToggle(true);
  }

  close(): void {
    this.openState = false;
    this.panel.hidden = true;
    this.onToggle(false);
  }

  append(role: "user" | "assistant", text: string): void {
    const item = this.log.ownerDocument.createElement("div");
    item.className = "asiyst-msg";
    item.setAttribute("data-role", role);
    renderSafeText(item, text);
    this.log.appendChild(item);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private async submit(): Promise<void> {
    const text = sanitizeText(this.input.value);
    if (!text) {
      return;
    }
    this.input.value = "";
    this.append("user", text);
    await this.onSubmit(text);
  }
}
