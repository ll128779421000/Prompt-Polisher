const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { RateLimit, User, ApiUsage } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Custom rate limiter that tracks usage by IP and user
 */
class CustomRateLimiter {
  constructor() {
    this.freeQueriesLimit = parseInt(process.env.FREE_QUERIES_LIMIT) || 5;
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000; // 1 hour
  }

  /**
   * Check if user/IP has exceeded free query limit
   */
  async checkFreeQueryLimit(req, res, next) {
    try {
      const ip = this.getClientIP(req);
      const userId = req.user?.id;
      const endpoint = req.route?.path || req.path;

      // Skip rate limiting for premium users
      if (req.user && req.user.subscription_status !== 'free') {
        return next();
      }

      const windowStart = new Date(Date.now() - this.windowMs);
      
      // Check usage for this IP/user in the current window
      const usageCount = await ApiUsage.count({
        where: {
          [Op.or]: [
            { ip_address: ip },
            ...(userId ? [{ user_id: userId }] : [])
          ],
          created_at: {
            [Op.gte]: windowStart
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        }
      });

      if (usageCount >= this.freeQueriesLimit) {
        logger.warn(`Rate limit exceeded for IP ${ip}, user ${userId}, count: ${usageCount}`);
        
        // Record rate limit event
        await this.recordRateLimit(ip, userId, endpoint, usageCount);
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You have exceeded the free query limit of ${this.freeQueriesLimit} requests per hour. Please upgrade to premium for unlimited access.`,
          retryAfter: Math.ceil((this.windowMs - (Date.now() - windowStart.getTime())) / 1000),
          upgradeUrl: '/api/payments/create-checkout-session'
        });
      }

      // Add usage info to request for downstream middleware
      req.rateLimitInfo = {
        usageCount,
        limit: this.freeQueriesLimit,
        remaining: this.freeQueriesLimit - usageCount,
        windowMs: this.windowMs
      };

      next();
    } catch (error) {
      logger.error('Error in rate limiting middleware:', error);
      next(error);
    }
  }

  /**
   * Record rate limit violation
   */
  async recordRateLimit(ip, userId, endpoint, requestCount) {
    try {
      const windowStart = new Date(Date.now() - this.windowMs);
      const windowEnd = new Date(Date.now());
      
      const identifier = userId || ip;
      const identifierType = userId ? 'user' : 'ip';

      await RateLimit.create({
        identifier,
        identifier_type: identifierType,
        endpoint,
        requests_count: requestCount,
        window_start: windowStart,
        window_end: windowEnd,
        is_blocked: true,
        block_reason: 'Free query limit exceeded'
      });
    } catch (error) {
      logger.error('Error recording rate limit:', error);
    }
  }

  /**
   * Get client IP address from various headers
   */
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           '0.0.0.0';
  }
}

const customRateLimiter = new CustomRateLimiter();

/**
 * Express rate limiter for DDoS protection
 */
const ddosProtection = rateLimit({
  windowMs: parseInt(process.env.DDOS_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.MAX_REQUESTS_PER_IP) || 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.DDOS_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`DDoS protection triggered for IP: ${customRateLimiter.getClientIP(req)}`);
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Slow down repeated requests
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed, then...
  delayMs: 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 5000, // maximum delay of 5 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  onLimitReached: (req, res, options) => {
    logger.warn(`Speed limit reached for IP: ${customRateLimiter.getClientIP(req)}`);
  }
});

/**
 * API-specific rate limiter
 */
const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
  max: parseInt(process.env.MAX_REQUESTS_PER_WINDOW) || 100,
  message: {
    error: 'API rate limit exceeded',
    message: 'Too many API requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || customRateLimiter.getClientIP(req);
  },
  skip: (req) => {
    // Skip rate limiting for premium users
    return req.user && req.user.subscription_status !== 'free';
  }
});

/**
 * Middleware to add rate limit headers
 */
const addRateLimitHeaders = (req, res, next) => {
  if (req.rateLimitInfo) {
    res.set({
      'X-RateLimit-Limit': req.rateLimitInfo.limit,
      'X-RateLimit-Remaining': req.rateLimitInfo.remaining,
      'X-RateLimit-Used': req.rateLimitInfo.usageCount,
      'X-RateLimit-Window': Math.ceil(req.rateLimitInfo.windowMs / 1000)
    });
  }
  next();
};

module.exports = {
  customRateLimiter,
  ddosProtection,
  speedLimiter,
  apiRateLimit,
  addRateLimitHeaders,
  checkFreeQueryLimit: customRateLimiter.checkFreeQueryLimit.bind(customRateLimiter)
};