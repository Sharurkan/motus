/** "4:30" or "0:07": rounded up, so that 0:00 only shows when the time is over. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/** Whole seconds left, rounded up: the number a countdown shows. */
export function secondsLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}
