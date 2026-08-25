export class HistoryObserver {
  private wrapped = false;
  private originalPush?: History["pushState"];
  private originalReplace?: History["replaceState"];
  private readonly onChange: () => void;

  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  start(win: Window, observeHistory: boolean): void {
    win.addEventListener("popstate", this.onChange);
    win.addEventListener("hashchange", this.onChange);
    if (!observeHistory || this.wrapped) {
      return;
    }
    this.originalPush = win.history.pushState.bind(win.history);
    this.originalReplace = win.history.replaceState.bind(win.history);
    const notify = this.onChange;
    win.history.pushState = (...args) => {
      this.originalPush?.(...args);
      notify();
    };
    win.history.replaceState = (...args) => {
      this.originalReplace?.(...args);
      notify();
    };
    this.wrapped = true;
  }

  stop(win: Window): void {
    win.removeEventListener("popstate", this.onChange);
    win.removeEventListener("hashchange", this.onChange);
    if (this.wrapped && this.originalPush && this.originalReplace) {
      win.history.pushState = this.originalPush;
      win.history.replaceState = this.originalReplace;
    }
    this.wrapped = false;
  }
}
