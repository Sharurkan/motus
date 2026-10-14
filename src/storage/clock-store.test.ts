import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAliveAt, saveAliveAt } from './clock-store';
import { blockedStorage, MemoryStorage } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clock store', () => {
  it('reads back the last moment the TV was running', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    expect(loadAliveAt()).toBeNull();
    expect(saveAliveAt(1_700_000_000_000)).toBe(true);
    expect(loadAliveAt()).toBe(1_700_000_000_000);
  });

  it('ignores a value that is not a time', () => {
    const storage = new MemoryStorage();
    storage.setItem('motus.tvAliveAt', 'hier');
    vi.stubGlobal('localStorage', storage);
    expect(loadAliveAt()).toBeNull();
  });

  it('copes with blocked storage', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    expect(saveAliveAt(1)).toBe(false);
    expect(loadAliveAt()).toBeNull();
  });
});
