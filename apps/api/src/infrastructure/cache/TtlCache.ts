/**
 * Minimal in-process TTL cache.
 *
 * Card data is read-heavy and effectively immutable, and YGOPRODeck asks
 * consumers to avoid repeat calls, so a simple TTL map is enough for the MVP.
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    // Evict the oldest insertion when full - insertion order is preserved by Map.
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next()
      if (!oldest.done) this.store.delete(oldest.value)
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  /**
   * Returns the cached value, or computes, stores and returns it.
   */
  async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) return cached
    const value = await factory()
    this.set(key, value)
    return value
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}
