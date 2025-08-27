import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// URL validation to prevent SSRF attacks
export function validateURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Block private/internal IP ranges
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Block localhost variations
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      return false;
    }
    
    // Block private IP ranges
    const ipPatterns = [
      /^10\./,          // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
      /^192\.168\./,    // 192.168.0.0/16
      /^169\.254\./,    // 169.254.0.0/16 (link-local)
      /^fc00:/,         // fc00::/7 (IPv6 unique local)
      /^fe80:/,         // fe80::/10 (IPv6 link-local)
      /^::1$/,          // IPv6 localhost
    ];
    
    for (const pattern of ipPatterns) {
      if (pattern.test(hostname)) {
        return false;
      }
    }
    
    // Block common internal domains
    const blockedDomains = [
      'internal',
      'local',
      'corp',
      'intranet',
      'admin',
      'test',
      'dev',
      'staging'
    ];
    
    for (const blocked of blockedDomains) {
      if (hostname.includes(blocked)) {
        return false;
      }
    }
    
    // Allow only specific trusted domains for API calls
    const allowedDomains = [
      'api.openai.com',
      'api.anthropic.com',
      'api.stripe.com',
      'hooks.stripe.com'
    ];
    
    // If it's an API call (not user-provided URL), must be from allowed domains
    if (url.includes('/v1/') || url.includes('/api/')) {
      return allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    }
    
    return true;
    
  } catch (error) {
    return false;
  }
}

// Middleware to validate URLs in requests
export function validateRequestURLs(req: Request, res: Response, next: NextFunction) {
  // Check common URL fields
  const urlFields = ['url', 'baseUrl', 'endpoint', 'webhook_url', 'callback_url'];
  
  for (const field of urlFields) {
    const value = req.body?.[field] || req.query?.[field];
    
    if (value && typeof value === 'string') {
      if (!validateURL(value)) {
        logger.warn('Blocked potentially dangerous URL', {
          field,
          url: value,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(400).json({
          error: 'Invalid URL provided',
          field,
          code: 'INVALID_URL'
        });
      }
    }
  }
  
  next();
}

// Safe fetch wrapper that validates URLs
export async function safeFetch(url: string, options: RequestInit = {}): Promise<globalThis.Response> {
  if (!validateURL(url)) {
    throw new Error('URL validation failed - potentially unsafe URL');
  }
  
  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Override potentially dangerous headers
      headers: {
        ...options.headers,
        'User-Agent': 'Perfect-AI-Prompts/1.0',
      }
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}