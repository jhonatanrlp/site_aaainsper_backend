interface Entry<V> {
  value: V;
  expiresAt: number;
}

// Minimal bounded TTL cache (no external dependency) used to avoid a network
// round-trip to Supabase / a DB read on every single request for identity
// and role lookups that rarely change within a few seconds.
export class TtlCache<K, V> {
  private readonly store = new Map<K, Entry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 5000,
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: K): void {
    this.store.delete(key);
  }
}
