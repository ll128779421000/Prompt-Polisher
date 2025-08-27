import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

const logger = createLogger();

// Enhanced input sanitization
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  function deepSanitize(obj: any): any {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters and patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/data:/gi, '') // Remove data: URLs
        .replace(/vbscript:/gi, '') // Remove vbscript: protocols
        .trim()
        .substring(0, 50000) // Limit length
    } else if (Array.isArray(obj)) {
      return obj.map(deepSanitize)
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof key === 'string') {
          // Sanitize keys too
          const cleanKey = key.replace(/[^\w\-_]/g, '').substring(0, 100)
          if (cleanKey) {
            sanitized[cleanKey] = deepSanitize(obj[key])
          }
        }
      }
      return sanitized
    }
    return obj
  }

  if (req.body) {
    req.body = deepSanitize(req.body)
  }
  
  if (req.query) {
    req.query = deepSanitize(req.query)
  }
  
  next()
}

// Request integrity validation
export function validateRequestIntegrity(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
    // Script injection attempts  
    /<script|javascript:|data:/i,
    // Path traversal attempts
    /\.\.\/|\.\.\\|\.\.\%/,
    // Command injection attempts
    /(\||;|&|`|\$\(|\$\{)/,
    // XXE attempts
    /<!ENTITY|<!DOCTYPE.*ENTITY/i,
  ]

  const requestStr = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  })

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestStr)) {
      logger.warn('Suspicious request pattern detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        pattern: pattern.toString()
      })
      
      return res.status(400).json({
        error: 'Invalid request format',
        code: 'INVALID_INPUT'
      })
    }
  }

  next()
}

// Enhanced rate limiting for suspicious IPs
const suspiciousIPTracker = new Map<string, { count: number, firstSeen: number }>()

export function trackSuspiciousActivity(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown'
  const userAgent = req.get('User-Agent') || ''
  const now = Date.now()
  
  // Track suspicious indicators
  let suspicionScore = 0
  
  // No user agent
  if (!userAgent) suspicionScore += 3
  
  // Common bot user agents
  if (/bot|crawler|spider|scraper|curl|wget/i.test(userAgent)) suspicionScore += 2
  
  // Too many different endpoints
  const endpointKey = `${ip}:endpoints`
  const endpoints = new Set(JSON.parse(process.env[endpointKey] || '[]'))
  endpoints.add(req.path)
  process.env[endpointKey] = JSON.stringify(Array.from(endpoints))
  if (endpoints.size > 10) suspicionScore += 2
  
  // Rapid requests
  const lastRequestKey = `${ip}:lastRequest`
  const lastRequest = parseInt(process.env[lastRequestKey] || '0')
  if (lastRequest && (now - lastRequest) < 100) suspicionScore += 4 // < 100ms between requests
  process.env[lastRequestKey] = now.toString()
  
  if (suspicionScore >= 5) {
    const tracker = suspiciousIPTracker.get(ip) || { count: 0, firstSeen: now }
    tracker.count++
    tracker.firstSeen = tracker.firstSeen || now
    suspiciousIPTracker.set(ip, tracker)
    
    logger.warn('Suspicious activity detected', {
      ip,
      userAgent,
      suspicionScore,
      count: tracker.count,
      url: req.url
    })
    
    // Block after multiple suspicious requests
    if (tracker.count > 5) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMITED'
      })
    }
  }
  
  next()
}

// Request signature validation (for high-security endpoints)
export function validateRequestSignature(secretKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-request-signature'] as string
    const timestamp = req.headers['x-request-timestamp'] as string
    const nonce = req.headers['x-request-nonce'] as string
    
    if (!signature || !timestamp || !nonce) {
      return res.status(401).json({
        error: 'Missing security headers',
        code: 'MISSING_SIGNATURE'
      })
    }
    
    // Check timestamp (must be within 5 minutes)
    const requestTime = parseInt(timestamp)
    const now = Date.now()
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({
        error: 'Request timestamp expired',
        code: 'EXPIRED_TIMESTAMP'
      })
    }
    
    // Validate signature
    const payload = `${req.method}:${req.path}:${timestamp}:${nonce}:${JSON.stringify(req.body || {})}`
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex')
    
    if (signature !== expectedSignature) {
      logger.warn('Invalid request signature', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        expectedSignature: expectedSignature.substring(0, 8) + '...'
      })
      
      return res.status(401).json({
        error: 'Invalid request signature',
        code: 'INVALID_SIGNATURE'
      })
    }
    
    // Check nonce replay (simple in-memory store for demo)
    const nonceKey = `nonce:${nonce}`
    if (process.env[nonceKey]) {
      return res.status(401).json({
        error: 'Nonce already used',
        code: 'REPLAY_ATTACK'
      })
    }
    process.env[nonceKey] = 'used'
    
    // Clean up old nonces (after 10 minutes)
    setTimeout(() => {
      delete process.env[nonceKey]
    }, 10 * 60 * 1000)
    
    next()
  }
}

// Content Security Policy
export function setSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Strict transport security (if HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  next()
}

// Advanced rate limiting with exponential backoff
export function createAdaptiveRateLimit(options: {
  windowMs: number
  max: number
  message: string
}) {
  const attempts = new Map<string, { count: number, resetTime: number }>()
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown'
    const now = Date.now()
    
    let attempt = attempts.get(ip)
    if (!attempt || now > attempt.resetTime) {
      attempt = { count: 0, resetTime: now + options.windowMs }
      attempts.set(ip, attempt)
    }
    
    attempt.count++
    
    if (attempt.count > options.max) {
      // Exponential backoff - double the wait time for each violation
      const violations = Math.floor(attempt.count / options.max)
      const backoffTime = options.windowMs * Math.pow(2, violations - 1)
      attempt.resetTime = now + backoffTime
      
      logger.warn('Rate limit exceeded with exponential backoff', {
        ip,
        count: attempt.count,
        backoffTime,
        url: req.url
      })
      
      return res.status(429).json({
        error: options.message,
        retryAfter: Math.ceil(backoffTime / 1000),
        code: 'RATE_LIMITED'
      })
    }
    
    next()
  }
}

// Cleanup old tracking data periodically
setInterval(() => {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000 // 1 hour
  
  for (const [ip, data] of suspiciousIPTracker.entries()) {
    if (now - data.firstSeen > maxAge) {
      suspiciousIPTracker.delete(ip)
    }
  }
}, 10 * 60 * 1000) // Clean up every 10 minutes