import { describe, expect, it } from "vitest";
import { computeAvatarDestination, isRectInComfortableView, anchorToViewport } from "../src/utils/geometry";

const viewport = { width: 1000, height: 800, scrollX: 0, scrollY: 0 };
const avatar = { width: 96, height: 120 };
const insets = { top: 64, right: 0, bottom: 0, left: 0 };

describe("movement calculations", () => {
  it("places the avatar beside the target instead of using a fixed coordinate", () => {
    const target = { x: 400, y: 300, width: 80, height: 40 };
    const plan = computeAvatarDestination({ target, viewport, avatarSize: avatar, insets });
    expect(plan.avatarX).toBe(target.x - avatar.width - 16);
    expect(plan.facing).toBe("right");
    expect(plan.avatarY).toBeGreaterThan(insets.top);
    expect(plan.needsScroll).toBe(false);
  });

  it("flips to the right when the left side has no room", () => {
    const target = { x: 20, y: 200, width: 50, height: 20 };
    const plan = computeAvatarDestination({ target, viewport, avatarSize: avatar, insets });
    expect(plan.avatarX).toBeGreaterThan(target.x);
    expect(plan.facing).toBe("left");
  });

  it("requests a scroll when the target sits under a fixed header", () => {
    const target = { x: 200, y: 10, width: 80, height: 20 };
    expect(isRectInComfortableView(target, viewport, insets)).toBe(false);
    const plan = computeAvatarDestination({ target, viewport, avatarSize: avatar, insets });
    expect(plan.needsScroll).toBe(true);
    expect(plan.scrollTop).toBeGreaterThanOrEqual(0);
  });

  it("clamps the rest position to the viewport for each anchor", () => {
    const br = anchorToViewport("bottom-right", viewport, avatar, insets);
    const bl = anchorToViewport("bottom-left", viewport, avatar, insets);
    expect(br.x).toBeGreaterThan(bl.x);
    expect(br.y).toBeGreaterThan(insets.top);
    expect(br.x + avatar.width).toBeLessThanOrEqual(viewport.width);
  });

  it("adapts when the viewport shrinks to a mobile width", () => {
    const mobile = { width: 360, height: 640, scrollX: 0, scrollY: 0 };
    const target = { x: 20, y: 400, width: 200, height: 40 };
    const plan = computeAvatarDestination({
      target,
      viewport: mobile,
      avatarSize: { width: 72, height: 96 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(plan.avatarX).toBeGreaterThanOrEqual(12);
    expect(plan.avatarX + 72).toBeLessThanOrEqual(360);
    expect(plan.avatarY).toBeGreaterThanOrEqual(12);
    expect(plan.avatarY + 96).toBeLessThanOrEqual(640);
  });
});
