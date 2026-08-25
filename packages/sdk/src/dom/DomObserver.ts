import { DOM_SCAN_DEBOUNCE_MS } from "../core/constants";
import { debounce } from "../utils/timing";

export class DomObserver {
  private observer: MutationObserver | undefined;
  private readonly notify: ReturnType<typeof debounce>;

  constructor(onChange: () => void) {
    this.notify = debounce(onChange, DOM_SCAN_DEBOUNCE_MS);
  }

  start(root: Node): void {
    this.stop();
    this.observer = new MutationObserver(() => this.notify());
    this.observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "data-asiyst", "disabled"],
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.notify.cancel();
  }
}
