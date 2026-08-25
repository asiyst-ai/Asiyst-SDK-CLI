import { afterEach, describe, expect, it, vi } from "vitest";
import { HighlightLayer } from "../src/highlighting/HighlightLayer";

describe("highlighting", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("draws an overlay box without rewriting the target element styles", () => {
    const target = document.createElement("button");
    target.textContent = "Buy";
    target.style.color = "rgb(255, 0, 0)";
    document.body.appendChild(target);
    target.getBoundingClientRect = () =>
      ({ x: 10, y: 20, width: 40, height: 16, top: 20, left: 10, right: 50, bottom: 36, toJSON() {} }) as DOMRect;

    const root = document.createElement("div");
    document.body.appendChild(root);
    const layer = new HighlightLayer(root, window);
    layer.start();
    layer.show(target, "outline");

    expect(target.style.color).toBe("rgb(255, 0, 0)");
    const box = root.querySelector(".asiyst-box") as HTMLElement;
    expect(box.style.left).toBe("6px");
    expect(box.style.width).toBe("48px");
    layer.hide();
    expect(box.style.display).toBe("none");
    layer.stop();
  });

  it("repositions the overlay after the viewport changes", () => {
    vi.useFakeTimers();
    const target = document.createElement("a");
    document.body.appendChild(target);
    let left = 10;
    target.getBoundingClientRect = () =>
      ({ x: left, y: 20, width: 30, height: 10, top: 20, left, right: left + 30, bottom: 30, toJSON() {} }) as DOMRect;

    const root = document.createElement("div");
    document.body.appendChild(root);
    const layer = new HighlightLayer(root, window);
    layer.start();
    layer.show(target, "glow");
    left = 80;
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
    const box = root.querySelector(".asiyst-box") as HTMLElement;
    expect(box.style.left).toBe("76px");
    layer.stop();
  });
});
