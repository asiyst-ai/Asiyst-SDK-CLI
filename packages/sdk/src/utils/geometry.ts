import type { Rect, SafeInsets, ViewportBox } from "../types";
import { AVATAR_TARGET_GAP, AVATAR_VIEWPORT_PADDING } from "../core/constants";

export interface MovementPlan {
  avatarX: number;
  avatarY: number;
  facing: "left" | "right";
  needsScroll: boolean;
  scrollLeft: number;
  scrollTop: number;
}

export interface MovementInput {
  target: Rect;
  viewport: ViewportBox;
  avatarSize: { width: number; height: number };
  insets: SafeInsets;
  gap?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isRectInComfortableView(
  target: Rect,
  viewport: ViewportBox,
  insets: SafeInsets,
): boolean {
  const top = insets.top + 8;
  const left = insets.left + 8;
  const right = viewport.width - insets.right - 8;
  const bottom = viewport.height - insets.bottom - 8;
  return (
    target.x >= left &&
    target.y >= top &&
    target.x + target.width <= right &&
    target.y + target.height <= bottom
  );
}

export function computeScrollTarget(
  target: Rect,
  viewport: ViewportBox,
  insets: SafeInsets,
): { left: number; top: number } {
  const visibleHeight = viewport.height - insets.top - insets.bottom;
  const visibleWidth = viewport.width - insets.left - insets.right;
  const desiredTop = target.y + viewport.scrollY - insets.top - visibleHeight / 2 + target.height / 2;
  const desiredLeft = target.x + viewport.scrollX - insets.left - visibleWidth / 2 + target.width / 2;
  return {
    left: Math.max(0, desiredLeft),
    top: Math.max(0, desiredTop),
  };
}

export function computeAvatarDestination(input: MovementInput): MovementPlan {
  const gap = input.gap ?? AVATAR_TARGET_GAP;
  const padding = AVATAR_VIEWPORT_PADDING;
  const { target, viewport, avatarSize, insets } = input;

  const minX = insets.left + padding;
  const minY = insets.top + padding;
  const maxX = viewport.width - insets.right - avatarSize.width - padding;
  const maxY = viewport.height - insets.bottom - avatarSize.height - padding;

  const leftCandidate = target.x - avatarSize.width - gap;
  const rightCandidate = target.x + target.width + gap;
  const centeredY = target.y + target.height / 2 - avatarSize.height / 2;

  let avatarX: number;
  let facing: "left" | "right";

  if (leftCandidate >= minX) {
    avatarX = leftCandidate;
    facing = "right";
  } else if (rightCandidate + avatarSize.width <= maxX + avatarSize.width) {
    avatarX = rightCandidate;
    facing = "left";
  } else {
    avatarX = minX;
    facing = "right";
  }

  const avatarY = clamp(centeredY, minY, Math.max(minY, maxY));
  avatarX = clamp(avatarX, minX, Math.max(minX, maxX));

  const needsScroll = !isRectInComfortableView(target, viewport, insets);
  const scroll = needsScroll ? computeScrollTarget(target, viewport, insets) : {
    left: viewport.scrollX,
    top: viewport.scrollY,
  };

  return {
    avatarX,
    avatarY,
    facing,
    needsScroll,
    scrollLeft: scroll.left,
    scrollTop: scroll.top,
  };
}

export function anchorToViewport(
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left",
  viewport: ViewportBox,
  avatarSize: { width: number; height: number },
  insets: SafeInsets,
): { x: number; y: number } {
  const padding = AVATAR_VIEWPORT_PADDING;
  const xLeft = insets.left + padding;
  const yTop = insets.top + padding;
  const xRight = viewport.width - insets.right - avatarSize.width - padding;
  const yBottom = viewport.height - insets.bottom - avatarSize.height - padding;

  switch (position) {
    case "bottom-left":
      return { x: xLeft, y: Math.max(yTop, yBottom) };
    case "top-right":
      return { x: Math.max(xLeft, xRight), y: yTop };
    case "top-left":
      return { x: xLeft, y: yTop };
    case "bottom-right":
    default:
      return { x: Math.max(xLeft, xRight), y: Math.max(yTop, yBottom) };
  }
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
