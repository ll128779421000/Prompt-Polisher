import { User } from '../db/database';
import { createLogger } from '../utils/logger';

interface RateLimitResult {
  allowed: boolean;
  queriesUsed: number;
  queriesLimit: number | string;
  resetTime?: Date;
  message?: string;
}

export class RateLimiter {
  private static readonly logger = createLogger();
  private static readonly FREE_QUERIES_PER_DAY = 5;

  static async checkUserLimit(user: User): Promise<RateLimitResult> {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily counter if it's a new day
    let queriesUsed = user.queries_today;
    if (user.last_query_date !== today) {
      queriesUsed = 0;
    }

    // Premium users have unlimited queries
    if (user.is_premium && this.isPremiumValid(user)) {
      return {
        allowed: true,
        queriesUsed,
        queriesLimit: 'unlimited'
      };
    }

    // Check free tier limits
    if (queriesUsed >= this.FREE_QUERIES_PER_DAY) {
      const resetTime = new Date();
      resetTime.setDate(resetTime.getDate() + 1);
      resetTime.setHours(0, 0, 0, 0);

      this.logger.warn(`Rate limit exceeded for user ${user.id}`, {
        userId: user.id,
        queriesUsed,
        queriesLimit: this.FREE_QUERIES_PER_DAY,
        ipAddress: user.ip_address
      });

      return {
        allowed: false,
        queriesUsed,
        queriesLimit: this.FREE_QUERIES_PER_DAY,
        resetTime,
        message: `You've used all ${this.FREE_QUERIES_PER_DAY} free queries today. Upgrade to premium for unlimited access or wait until tomorrow.`
      };
    }

    return {
      allowed: true,
      queriesUsed,
      queriesLimit: this.FREE_QUERIES_PER_DAY
    };
  }

  static isPremiumValid(user: User): boolean {
    if (!user.is_premium) return false;
    
    if (user.premium_expires_at) {
      const expiryDate = new Date(user.premium_expires_at);
      return expiryDate > new Date();
    }
    
    // If no expiry date, assume premium is valid
    return true;
  }

  static async checkIPLimit(ipAddress: string): Promise<boolean> {
    // Additional IP-based rate limiting for abuse prevention
    // This would typically use Redis or in-memory cache
    // For now, we'll use a simple in-memory approach
    
    const ipLimits = this.getIPLimitCache();
    const hourlyLimit = 50; // 50 requests per hour per IP
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
    
    const key = `${ipAddress}:${currentHour}`;
    const currentCount = ipLimits.get(key) || 0;
    
    if (currentCount >= hourlyLimit) {
      this.logger.warn(`IP rate limit exceeded`, {
        ipAddress,
        requests: currentCount,
        limit: hourlyLimit
      });
      return false;
    }
    
    ipLimits.set(key, currentCount + 1);
    
    // Clean up old entries (keep only current hour)
    for (const [cacheKey] of ipLimits.entries()) {
      const [, hour] = cacheKey.split(':');
      if (parseInt(hour) < currentHour) {
        ipLimits.delete(cacheKey);
      }
    }
    
    return true;
  }

  private static ipLimitCache = new Map<string, number>();
  
  private static getIPLimitCache(): Map<string, number> {
    return this.ipLimitCache;
  }

  static getTimeUntilReset(user: User): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  static getRemainingQueries(user: User): number {
    if (user.is_premium && this.isPremiumValid(user)) {
      return -1; // Unlimited
    }

    const today = new Date().toISOString().split('T')[0];
    const queriesUsed = user.last_query_date === today ? user.queries_today : 0;
    
    return Math.max(0, this.FREE_QUERIES_PER_DAY - queriesUsed);
  }

  static getPremiumBenefits(): object {
    return {
      unlimitedQueries: true,
      prioritySupport: true,
      advancedAnalytics: true,
      customPromptTemplates: true,
      exportHistory: true,
      apiAccess: false // Future feature
    };
  }

  static getUsageStats(user: User): object {
    const today = new Date().toISOString().split('T')[0];
    const queriesUsedToday = user.last_query_date === today ? user.queries_today : 0;
    
    return {
      queriesUsedToday,
      queriesLimitToday: user.is_premium ? 'unlimited' : this.FREE_QUERIES_PER_DAY,
      totalQueries: user.total_queries,
      isPremium: user.is_premium && this.isPremiumValid(user),
      premiumExpiresAt: user.premium_expires_at,
      remainingQueries: this.getRemainingQueries(user),
      resetTime: this.getTimeUntilReset(user)
    };
  }
}