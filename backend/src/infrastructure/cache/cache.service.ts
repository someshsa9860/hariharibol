import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger('CacheService');

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache hit: ${key}`);
      }
      return value || null;
    } catch (error) {
      this.logger.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl || 3600000); // 1 hour default
      this.logger.debug(`Cache set: ${key} (TTL: ${ttl || 3600000}ms)`);
    } catch (error) {
      this.logger.error(`Cache set error for ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.cacheManager.store.getKeys();
      const matching = keys.filter((key) => key.includes(pattern));

      for (const key of matching) {
        await this.cacheManager.del(key);
      }

      this.logger.debug(`Cache deleted ${matching.length} keys matching: ${pattern}`);
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.log('Cache cleared completely');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(key);
      if (cached) {
        return cached;
      }

      // Not in cache, compute value
      const value = await factory();

      // Store in cache
      await this.set(key, value, ttl);

      return value;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for ${key}:`, error);
      // If cache fails, just compute the value
      return factory();
    }
  }

  async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};

    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }

    return result;
  }

  async mset<T>(values: Record<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key, value, ttl);
    }
  }

  // Cache key builders
  static buildVerseKey(verseId: string): string {
    return `verse:${verseId}`;
  }

  static buildVersesListKey(skip: number, take: number): string {
    return `verses:list:${skip}:${take}`;
  }

  static buildSampradayKey(sampradayId: string): string {
    return `sampraday:${sampradayId}`;
  }

  static buildSampradaysListKey(skip: number, take: number): string {
    return `sampradayas:list:${skip}:${take}`;
  }

  static buildUserKey(userId: string): string {
    return `user:${userId}`;
  }

  static buildVerseOfDayKey(date: string): string {
    return `verse-of-day:${date}`;
  }

  static buildAppSettingsKey(key: string): string {
    return `app-settings:${key}`;
  }

  static buildSearchKey(query: string, type: string): string {
    return `search:${type}:${query}`;
  }
}
