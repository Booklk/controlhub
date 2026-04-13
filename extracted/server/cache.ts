import { logger } from './security-middleware';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    setInterval(() => this.cleanup(), 60_000);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      // Evict oldest entries when cache is full
      const entries = Array.from(this.store.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toEvict = Math.ceil(this.maxSize * 0.1);
      entries.slice(0, toEvict).forEach(([k]) => this.store.delete(k));
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(pattern: string): void {
    const keysToDelete = Array.from(this.store.keys()).filter(k => k.startsWith(pattern));
    keysToDelete.forEach(k => this.store.delete(k));
  }

  invalidateAll(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.store.delete(key);
      cleaned++;
    });
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

export const cache = new MemoryCache();

export const TTL = {
  DASHBOARD_STATS: 2 * 60 * 1000,      // 2 min (was 30s)
  GOVERNANCE_SCORE: 5 * 60 * 1000,     // 5 min (was 60s)
  NAVIGATION_METRICS: 3 * 60 * 1000,   // 3 min (was 15s)
  ADMIN_CHARTS: 10 * 60 * 1000,        // 10 min (was 2 min)
  DEPARTMENTS: 15 * 60 * 1000,         // 15 min (was 5 min)
  USERS_LIST: 3 * 60 * 1000,           // 3 min (was 60s)
  INFRASTRUCTURE_STATS: 2 * 60 * 1000, // 2 min (was 60s)
  SUPPORT_STATS: 2 * 60 * 1000,        // 2 min (was 60s)
  DIGITAL_STATS: 5 * 60 * 1000,        // 5 min (was 60s)
  COMMITTEE_STATS: 5 * 60 * 1000,      // 5 min (was 60s)
  KPI_SUMMARY: 5 * 60 * 1000,          // 5 min
  STATIC_DATA: 15 * 60 * 1000,         // 15 min for rarely-changing data
} as const;

export function invalidateDashboardCaches(): void {
  cache.invalidate('dashboard_stats');
  cache.invalidate('admin_charts');
  cache.invalidate('it_director_stats');
  cache.invalidate('cybersecurity_stats');
  cache.invalidate('governance_score');
  cache.invalidate('nav_metrics_');
  cache.invalidate('infrastructure_stats');
  cache.invalidate('support_stats');
  cache.invalidate('digital_stats');
  cache.invalidate('committee_stats');
  cache.invalidate('departments_list');
  cache.invalidate('my_day_');
  cache.invalidate('attention_');
}
