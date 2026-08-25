export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function durationForDistance(distance: number, speed = 1, reducedMotion = false): number {
  if (reducedMotion) {
    return 0;
  }
  return Math.min(900, Math.max(180, distance / Math.max(speed, 0.2)));
}
