/**
 * Server-Side Stats Caching - Control Hub JCSA
 * نظام التخزين المؤقت للإحصائيات على جانب الخادم
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl: number; // Time to live in milliseconds
}

class StatsCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 60 * 1000; // 1 minute default

  // Cache TTL configurations for different data types
  private ttlConfig: Record<string, number> = {
    'dashboard:admin': 2 * 60 * 1000,     // 2 minutes
    'dashboard:it-director': 60 * 1000,    // 1 minute
    'dashboard:cybersecurity': 60 * 1000,  // 1 minute
    'dashboard:dmo': 2 * 60 * 1000,        // 2 minutes
    'dashboard:committee': 2 * 60 * 1000,  // 2 minutes
    'stats:tickets': 30 * 1000,            // 30 seconds
    'stats:projects': 60 * 1000,           // 1 minute
    'stats:users': 5 * 60 * 1000,          // 5 minutes
    'stats:compliance': 5 * 60 * 1000,     // 5 minutes
    'kpis': 2 * 60 * 1000,                 // 2 minutes
    'audit:summary': 5 * 60 * 1000,        // 5 minutes
  };

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, options?: CacheOptions): void {
    const ttl = options?.ttl || this.ttlConfig[key] || this.defaultTTL;
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }
}

export const statsCache = new StatsCache();

export function invalidateDashboardCache(portal?: string): void {
  if (portal) {
    statsCache.invalidate(`dashboard:${portal}`);
  } else {
    statsCache.invalidatePattern('^dashboard:');
  }
}

export function invalidateStatsCache(type?: string): void {
  if (type) {
    statsCache.invalidate(`stats:${type}`);
  } else {
    statsCache.invalidatePattern('^stats:');
  }
}

export default statsCache;
