import { HOST_ELEMENT_ID } from "./constants";

export class HostRoot {
  readonly host: HTMLDivElement;
  readonly shadow: ShadowRoot;
  readonly overlay: HTMLDivElement;
  readonly chrome: HTMLDivElement;

  constructor(doc: Document) {
    this.host = doc.createElement("div");
    this.host.id = HOST_ELEMENT_ID;
    this.host.setAttribute("data-asiyst-root", "true");
    this.host.style.all = "initial";
    this.host.style.position = "relative";
    this.host.style.zIndex = "2147483646";
    this.shadow = this.host.attachShadow({ mode: "open" });

    this.overlay = doc.createElement("div");
    this.overlay.setAttribute("data-asiyst-layer", "overlay");
    this.chrome = doc.createElement("div");
    this.chrome.setAttribute("data-asiyst-layer", "chrome");
    this.shadow.append(this.overlay, this.chrome);
    doc.body.appendChild(this.host);
  }

  destroy(): void {
    this.host.remove();
  }
}
