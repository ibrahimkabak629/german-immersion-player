export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

export function formatSpeed(rate: number): string {
  return `${rate % 1 === 0 ? rate.toFixed(0) : rate}×`;
}

/** Steps to the next slower/faster defined speed, clamped to the ends — used by the </> shortcuts. */
export function stepSpeed(current: number, direction: 1 | -1): number {
  const index = SPEED_OPTIONS.indexOf(current as PlaybackSpeed);
  const currentIndex = index === -1 ? SPEED_OPTIONS.indexOf(1) : index;
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), SPEED_OPTIONS.length - 1);
  return SPEED_OPTIONS[nextIndex];
}
