import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PaymentCacheService {
  private readonly logger = new Logger(PaymentCacheService.name);

  // Cache key prefixes
  private readonly PAYMENT_TYPES_KEY = 'payment_types';
  private readonly PAYMENT_TYPE_KEY = 'payment_type';
  private readonly COOPERATIVE_PAYMENT_TYPES_KEY = 'coop_payment_types';

  // TTL configurations (in seconds)
  private readonly PAYMENT_TYPES_TTL = 600; // 10 minutes
  private readonly PAYMENT_TYPE_TTL = 300; // 5 minutes
  private readonly USSD_OPTIMIZED_TTL = 180; // 3 minutes for USSD/mobile

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Cache all payment types for a cooperative
   */
  async cacheCooperativePaymentTypes(
    cooperativeId: string,
    paymentTypes: any[],
    ussdOptimized: boolean = false,
  ): Promise<void> {
    try {
      const key = this.getCooperativePaymentTypesKey(cooperativeId);
      const ttl = ussdOptimized
        ? this.USSD_OPTIMIZED_TTL
        : this.PAYMENT_TYPES_TTL;

      await this.cacheManager.set(key, paymentTypes, ttl);

      this.logger.debug(
        `Cached payment types for cooperative ${cooperativeId}`,
        {
          count: paymentTypes.length,
          ttl,
          ussdOptimized,
        },
      );
    } catch (error) {
      this.logger.error('Failed to cache cooperative payment types', {
        cooperativeId,
        error: error.message,
      });
    }
  }

  /**
   * Get cached payment types for a cooperative
   */
  async getCooperativePaymentTypes(
    cooperativeId: string,
  ): Promise<any[] | null> {
    try {
      const key = this.getCooperativePaymentTypesKey(cooperativeId);
      const cached = await this.cacheManager.get<any[]>(key);

      if (cached) {
        this.logger.debug(
          `Cache hit for cooperative payment types: ${cooperativeId}`,
        );
        return cached;
      }

      this.logger.debug(
        `Cache miss for cooperative payment types: ${cooperativeId}`,
      );
      return null;
    } catch (error) {
      this.logger.error('Failed to get cached cooperative payment types', {
        cooperativeId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Cache a specific payment type
   */
  async cachePaymentType(
    paymentType: any,
    ussdOptimized: boolean = false,
  ): Promise<void> {
    try {
      const key = this.getPaymentTypeKey(paymentType.id);
      const ttl = ussdOptimized
        ? this.USSD_OPTIMIZED_TTL
        : this.PAYMENT_TYPE_TTL;

      await this.cacheManager.set(key, paymentType, ttl);

      this.logger.debug(`Cached payment type ${paymentType.id}`, {
        ttl,
        ussdOptimized,
      });
    } catch (error) {
      this.logger.error('Failed to cache payment type', {
        paymentTypeId: paymentType.id,
        error: error.message,
      });
    }
  }

  /**
   * Get cached payment type by ID
   */
  async getPaymentType(paymentTypeId: string): Promise<any | null> {
    try {
      const key = this.getPaymentTypeKey(paymentTypeId);
      const cached = await this.cacheManager.get<any>(key);

      if (cached) {
        this.logger.debug(`Cache hit for payment type: ${paymentTypeId}`);
        return cached;
      }

      this.logger.debug(`Cache miss for payment type: ${paymentTypeId}`);
      return null;
    } catch (error) {
      this.logger.error('Failed to get cached payment type', {
        paymentTypeId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Invalidate cache for a specific payment type
   */
  async invalidatePaymentType(paymentTypeId: string): Promise<void> {
    try {
      const key = this.getPaymentTypeKey(paymentTypeId);
      await this.cacheManager.del(key);

      this.logger.debug(`Invalidated cache for payment type: ${paymentTypeId}`);
    } catch (error) {
      this.logger.error('Failed to invalidate payment type cache', {
        paymentTypeId,
        error: error.message,
      });
    }
  }

  /**
   * Invalidate cache for all payment types of a cooperative
   */
  async invalidateCooperativePaymentTypes(
    cooperativeId: string,
  ): Promise<void> {
    try {
      const key = this.getCooperativePaymentTypesKey(cooperativeId);
      await this.cacheManager.del(key);

      this.logger.debug(
        `Invalidated cache for cooperative payment types: ${cooperativeId}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to invalidate cooperative payment types cache',
        {
          cooperativeId,
          error: error.message,
        },
      );
    }
  }

  /**
   * Cache active payment types (for USSD menus and mobile apps)
   */
  async cacheActivePaymentTypes(
    cooperativeId: string,
    activePaymentTypes: any[],
  ): Promise<void> {
    try {
      const key = this.getActivePaymentTypesKey(cooperativeId);

      // Use shorter TTL for active payment types as they're frequently accessed
      await this.cacheManager.set(
        key,
        activePaymentTypes,
        this.USSD_OPTIMIZED_TTL,
      );

      this.logger.debug(
        `Cached active payment types for cooperative ${cooperativeId}`,
        {
          count: activePaymentTypes.length,
        },
      );
    } catch (error) {
      this.logger.error('Failed to cache active payment types', {
        cooperativeId,
        error: error.message,
      });
    }
  }

  /**
   * Get cached active payment types
   */
  async getActivePaymentTypes(cooperativeId: string): Promise<any[] | null> {
    try {
      const key = this.getActivePaymentTypesKey(cooperativeId);
      const cached = await this.cacheManager.get<any[]>(key);

      if (cached) {
        this.logger.debug(
          `Cache hit for active payment types: ${cooperativeId}`,
        );
        return cached;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get cached active payment types', {
        cooperativeId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Clear all payment-related cache
   */
  async clearAllPaymentCache(): Promise<void> {
    try {
      // Note: This is a simplified approach. In production, you might want
      // to use Redis SCAN to find and delete all payment-related keys
      // For now, we'll use the store's reset method if available
      const store = (this.cacheManager as any).store;
      if (store && typeof store.reset === 'function') {
        await store.reset();
      }

      this.logger.warn('Cleared all payment cache');
    } catch (error) {
      this.logger.error('Failed to clear payment cache', {
        error: error.message,
      });
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    paymentTypeKeys: number;
    cooperativeKeys: number;
  }> {
    try {
      // This would require Redis-specific implementation
      // For now, return basic stats
      return {
        totalKeys: 0,
        paymentTypeKeys: 0,
        cooperativeKeys: 0,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', {
        error: error.message,
      });
      return {
        totalKeys: 0,
        paymentTypeKeys: 0,
        cooperativeKeys: 0,
      };
    }
  }

  // Private helper methods for key generation
  private getCooperativePaymentTypesKey(cooperativeId: string): string {
    return `${this.COOPERATIVE_PAYMENT_TYPES_KEY}:${cooperativeId}`;
  }

  private getPaymentTypeKey(paymentTypeId: string): string {
    return `${this.PAYMENT_TYPE_KEY}:${paymentTypeId}`;
  }

  private getActivePaymentTypesKey(cooperativeId: string): string {
    return `${this.COOPERATIVE_PAYMENT_TYPES_KEY}:active:${cooperativeId}`;
  }
}
