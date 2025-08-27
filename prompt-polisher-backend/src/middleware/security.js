const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * CORS configuration for browser extension
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests from extension
    const allowedOrigins = [
      process.env.CORS_ORIGIN, // Extension ID
      'http://localhost:3000', // Development
      'https://localhost:3000',
      'chrome-extension://' // Any Chrome extension for development
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin || allowedOrigins.some(allowed => 
      origin === allowed || 
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('moz-extension://') ||
      origin.startsWith('safari-web-extension://')
    )) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Extension-Id',
    'X-Extension-Version'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-Used'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

/**
 * Helmet security configuration
 */
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disabled for extension compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
};

/**
 * Advanced DDoS protection
 */
const ddosProtection = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Different limits based on endpoint
    if (req.path.startsWith('/api/llm/')) {
      return req.user?.subscription_status !== 'free' ? 200 : 10;
    }
    if (req.path.startsWith('/api/payments/')) {
      return 20;
    }
    if (req.path.startsWith('/api/auth/')) {
      return 10;
    }
    return 100; // Default limit
  },
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    type: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || req.ip;
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for ${req.ip}, user: ${req.user?.id}, path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Gradual speed reduction for suspicious behavior
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests at full speed
  delayMs: 100, // add 100ms delay per request after delayAfter
  maxDelayMs: 3000, // max delay of 3 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  onLimitReached: (req) => {
    logger.warn(`Speed limit reached for ${req.ip}, user: ${req.user?.id}`);
  }
});

/**
 * JWT Authentication middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      req.user = null;
      return next(); // Continue without user for public endpoints
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'subscription_status', 'subscription_end_date', 'is_active']
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found or account disabled'
      });
    }

    // Check subscription status
    if (!user.isSubscriptionActive()) {
      user.subscription_status = 'free';
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn(`JWT verification failed: ${error.message}, IP: ${req.ip}`);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please log in again'
      });
    }
    
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed'
    });
  }
};

/**
 * Require authentication middleware
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  next();
};

/**
 * Require premium subscription middleware
 */
const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  if (req.user.subscription_status === 'free') {
    return res.status(403).json({
      error: 'Premium subscription required',
      message: 'This feature requires a premium subscription',
      upgradeUrl: '/api/payments/create-checkout-session'
    });
  }

  next();
};

/**
 * IP whitelist/blacklist middleware
 */
const ipFilter = (req, res, next) => {
  const ip = req.ip;
  
  // Blacklisted IPs (could be stored in database/Redis)
  const blacklistedIPs = process.env.BLACKLISTED_IPS?.split(',') || [];
  
  if (blacklistedIPs.includes(ip)) {
    logger.warn(`Blocked request from blacklisted IP: ${ip}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked'
    });
  }

  next();
};

/**
 * Request size limiter
 */
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 1024 * 1024; // 1MB
  
  if (req.get('Content-Length') > maxSize) {
    logger.warn(`Request too large from IP: ${req.ip}, size: ${req.get('Content-Length')}`);
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request body size exceeds limit'
    });
  }

  next();
};

/**
 * Browser/Extension validation
 */
const validateExtension = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const extensionId = req.get('X-Extension-Id') || '';
  const extensionVersion = req.get('X-Extension-Version') || '';

  // Log extension info for monitoring
  if (extensionId) {
    logger.info(`Extension request: ID=${extensionId}, Version=${extensionVersion}, UA=${userAgent}`);
  }

  // Validate extension ID if provided
  if (extensionId && process.env.ALLOWED_EXTENSION_IDS) {
    const allowedIds = process.env.ALLOWED_EXTENSION_IDS.split(',');
    if (!allowedIds.includes(extensionId)) {
      logger.warn(`Invalid extension ID: ${extensionId} from IP: ${req.ip}`);
      return res.status(403).json({
        error: 'Invalid extension',
        message: 'Extension not authorized'
      });
    }
  }

  next();
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Server': 'Prompt-Polisher-API' // Hide server info
  });

  next();
};

/**
 * Request monitoring middleware
 */
const requestMonitor = (req, res, next) => {
  req.startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./g, // Directory traversal
    /<script/gi, // XSS
    /union.*select/gi, // SQL injection
    /exec\(/gi, // Code injection
    /eval\(/gi // Code injection
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.error(`Suspicious request detected from IP: ${req.ip}, pattern: ${pattern}, data: ${requestData}`);
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request contains invalid data'
      });
    }
  }

  next();
};

module.exports = {
  cors: cors(corsOptions),
  helmet: helmet(helmetConfig),
  compression: compression(),
  ddosProtection,
  speedLimiter,
  authenticateToken,
  requireAuth,
  requirePremium,
  ipFilter,
  requestSizeLimiter,
  validateExtension,
  securityHeaders,
  requestMonitor
};