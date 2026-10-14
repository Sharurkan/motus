/** Test helper: an in-memory localStorage. */
export class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** Test helper: a localStorage that throws, like a blocked one in private mode. */
export function blockedStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  const fail = (): never => {
    throw new Error('blocked');
  };
  storage.getItem = fail;
  storage.setItem = fail;
  storage.removeItem = fail;
  return storage;
}
