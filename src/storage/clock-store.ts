const ALIVE_KEY = 'motus.tvAliveAt';

/**
 * Last moment the TV was running, written every second during a game. After a
 * reload, the time since then is the time the TV was gone: it does not count.
 * Returns false when storage is unavailable.
 */
export function saveAliveAt(now: number): boolean {
  try {
    localStorage.setItem(ALIVE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

/** Null when nothing readable is saved or when storage is unavailable. */
export function loadAliveAt(): number | null {
  try {
    const raw = localStorage.getItem(ALIVE_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
