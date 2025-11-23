import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

interface CacheOptions {
  ttl?: number;
  prefix?: string;
  tags?: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

@Injectable()
export class EnhancedCacheService {
  private readonly logger = new Logger(EnhancedCacheService.name);
  private readonly stats = {
    hits: 0,
    misses: 0,
  };

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  /**
   * Get item from cache with automatic deserialization
   */
  async get<T>(key: string, prefix?: string): Promise<T | undefined> {
    try {
      const fullKey = this.buildKey(key, prefix);
      const value = await this.cacheManager.get<T>(fullKey);

      if (value !== undefined) {
        this.stats.hits++;
        this.logger.debug(`Cache HIT for key: ${fullKey}`);
        return value;
      } else {
        this.stats.misses++;
        this.logger.debug(`Cache MISS for key: ${fullKey}`);
        return undefined;
      }
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set item in cache with automatic serialization
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options.prefix);
      const ttl = options.ttl || this.getDefaultTTL(options.prefix);

      await this.cacheManager.set(fullKey, value, ttl);
      this.logger.debug(`Cache SET for key: ${fullKey}, TTL: ${ttl}s`);

      // Store tags for cache invalidation
      if (options.tags && options.tags.length > 0) {
        await this.tagKey(fullKey, options.tags);
      }
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete specific key from cache
   */
  async del(key: string, prefix?: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key, prefix);
      await this.cacheManager.del(fullKey);
      this.logger.debug(`Cache DELETE for key: ${fullKey}`);
    } catch (error) {
      this.logger.error(`Cache DELETE error for key ${key}:`, error);
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key, options.prefix);

    if (cached !== undefined) {
      return cached;
    }

    try {
      const value = await factory();
      await this.set(key, value, options);
      return value;
    } catch (error) {
      this.logger.error(`Cache factory function error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple keys at once
   */
  async getMultiple<T>(
    keys: string[],
    prefix?: string,
  ): Promise<Record<string, T | undefined>> {
    const result: Record<string, T | undefined> = {};

    await Promise.all(
      keys.map(async (key) => {
        result[key] = await this.get<T>(key, prefix);
      }),
    );

    return result;
  }

  /**
   * Set multiple keys at once
   */
  async setMultiple<T>(
    items: Record<string, T>,
    options: CacheOptions = {},
  ): Promise<void> {
    await Promise.all(
      Object.entries(items).map(([key, value]) =>
        this.set(key, value, options),
      ),
    );
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const taggedKeys = await this.getTaggedKeys(tag);
        if (taggedKeys.length > 0) {
          await Promise.all(
            taggedKeys.map((key) => this.cacheManager.del(key)),
          );
          await this.clearTag(tag);
          this.logger.debug(
            `Invalidated ${taggedKeys.length} keys for tag: ${tag}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cache invalidation error for tags ${tags.join(', ')}:`,
        error,
      );
    }
  }

  /**
   * Invalidate cache by pattern (Redis specific)
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;

      if (store && store.client && store.client.keys) {
        const keys = await store.client.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(
            keys.map((key: string) => this.cacheManager.del(key)),
          );
          this.logger.debug(
            `Invalidated ${keys.length} keys matching pattern: ${pattern}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cache pattern invalidation error for pattern ${pattern}:`,
        error,
      );
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      size: total,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      // For cache-manager, use del with wildcard or store.clear()
      const store = (this.cacheManager as any).store;
      if (store && store.clear) {
        await store.clear();
      } else {
        // Fallback method
        this.logger.warn(
          'Cache clear not fully supported - use invalidateByPattern instead',
        );
      }
      this.logger.warn('Cache entries cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  /**
   * Warm up cache with common data
   */
  async warmUp(): Promise<void> {
    this.logger.log('Starting cache warm-up...');

    try {
      // Add cache warm-up logic here for frequently accessed data
      // Example: Load common lookup tables, active cooperatives, etc.

      this.logger.log('Cache warm-up completed');
    } catch (error) {
      this.logger.error('Cache warm-up error:', error);
    }
  }

  private buildKey(key: string, prefix?: string): string {
    const prefixConfig = this.configService.get('performance.cache.prefixes');
    const actualPrefix =
      prefix && prefixConfig[prefix] ? prefixConfig[prefix] : prefix || '';
    return `${actualPrefix}${key}`;
  }

  private getDefaultTTL(prefix?: string): number {
    const ttlConfig = this.configService.get('performance.cache.ttl');
    if (prefix && ttlConfig[prefix]) {
      return ttlConfig[prefix];
    }
    return ttlConfig.static || 300; // 5 minutes default
  }

  private async tagKey(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const existingKeys = (await this.get<string[]>(tagKey, 'cache')) || [];
        if (!existingKeys.includes(key)) {
          existingKeys.push(key);
          await this.set(tagKey, existingKeys, {
            prefix: 'cache',
            ttl: 3600, // 1 hour for tag storage
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error tagging key ${key}:`, error);
    }
  }

  private async getTaggedKeys(tag: string): Promise<string[]> {
    try {
      return (await this.get<string[]>(`tag:${tag}`, 'cache')) || [];
    } catch (error) {
      this.logger.error(`Error getting tagged keys for tag ${tag}:`, error);
      return [];
    }
  }

  private async clearTag(tag: string): Promise<void> {
    try {
      await this.del(`tag:${tag}`, 'cache');
    } catch (error) {
      this.logger.error(`Error clearing tag ${tag}:`, error);
    }
  }
}
