import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { Database, User } from '../db/database';
import { LLMProvider } from '../services/llmProvider';
import { RateLimiter } from '../middleware/rateLimiter';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const logger = createLogger();

// Rate limiting for prompt improvement
const promptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Max 100 requests per hour per IP
  message: {
    error: 'Rate limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation
const validatePromptImprovement = [
  body('text')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Prompt text must be between 1 and 10,000 characters')
    .trim()
    .escape(),
  body('provider')
    .optional()
    .isIn(['openai', 'anthropic', 'local'])
    .withMessage('Provider must be openai, anthropic, or local'),
  body('language')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Language code must be max 10 characters'),
];

// Improve prompt endpoint
router.post('/improve', 
  promptLimiter,
  validatePromptImprovement,
  async (req: express.Request, res: express.Response) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { text, provider = 'openai', language } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const extensionId = req.headers['x-extension-id'] as string;

      // Get or create user
      let user = await Database.getUserByIP(ipAddress);
      if (!user) {
        user = await Database.createUser({
          id: uuidv4(),
          ip_address: ipAddress,
          queries_today: 0,
          total_queries: 0,
          last_query_date: new Date().toISOString().split('T')[0]
        });
      }

      // Check rate limits and usage quota
      const rateLimitResult = await RateLimiter.checkUserLimit(user);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: rateLimitResult.message,
          queriesUsed: rateLimitResult.queriesUsed,
          queriesLimit: rateLimitResult.queriesLimit,
          resetTime: rateLimitResult.resetTime,
          isPremium: user.is_premium,
          upgradeUrl: `${process.env.FRONTEND_URL}/upgrade`
        });
      }

      // Track the query attempt
      await Database.incrementUserQueries(user.id);

      let improvedPrompt: string;
      let cost = 0;
      let tokensUsed = 0;
      let success = true;
      let errorMessage: string | undefined;

      try {
        // Use LLM provider to improve the prompt
        const result = await LLMProvider.improvePrompt(text, provider, language);
        improvedPrompt = result.improvedPrompt;
        cost = result.usage?.cost || 0;
        tokensUsed = result.usage?.tokens || 0;

        logger.info(`Prompt improved successfully for user ${user.id}`, {
          userId: user.id,
          ipAddress,
          provider,
          cost,
          tokensUsed
        });

      } catch (error: any) {
        success = false;
        errorMessage = error.message;
        improvedPrompt = text; // Return original text on error
        
        logger.error(`Prompt improvement failed for user ${user.id}`, {
          userId: user.id,
          ipAddress,
          provider,
          error: error.message
        });
      }

      // Log usage to database
      await Database.createUsage({
        user_id: user.id,
        query_text: text,
        response_text: improvedPrompt,
        provider,
        cost,
        tokens_used: tokensUsed,
        ip_address: ipAddress,
        success,
        error_message: errorMessage
      });

      // Get updated user info for response
      const updatedUser = await Database.getUserById(user.id);
      
      res.json({
        success,
        improvedPrompt,
        originalText: text,
        provider,
        usage: {
          cost,
          tokens: tokensUsed,
          queriesUsed: updatedUser?.queries_today || 0,
          queriesLimit: updatedUser?.is_premium ? 'unlimited' : 5,
          isPremium: updatedUser?.is_premium || false
        },
        ...(errorMessage && { error: errorMessage })
      });

    } catch (error: any) {
      logger.error('Prompt improvement endpoint error', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.'
      });
    }
  }
);

// Get user usage statistics
router.get('/usage/:userId?', async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.params.userId;

    let user: User | undefined;
    if (userId) {
      user = await Database.getUserById(userId);
    } else {
      user = await Database.getUserByIP(ipAddress);
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const usage = await Database.getUserUsage(user.id, 10);
    
    res.json({
      user: {
        id: user.id,
        isPremium: user.is_premium,
        premiumExpiresAt: user.premium_expires_at,
        totalQueries: user.total_queries,
        queriesToday: user.queries_today,
        queriesLimit: user.is_premium ? 'unlimited' : 5,
        lastQueryDate: user.last_query_date
      },
      recentUsage: usage.map(u => ({
        id: u.id,
        queryText: u.query_text.substring(0, 100) + (u.query_text.length > 100 ? '...' : ''),
        provider: u.provider,
        cost: u.cost,
        tokensUsed: u.tokens_used,
        success: u.success,
        createdAt: u.created_at
      }))
    });

  } catch (error: any) {
    logger.error('Usage endpoint error', {
      error: error.message
    });

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Health check for prompt service
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const stats = await Database.getUsageStats();
    
    // Test LLM provider availability (use local/offline mode)
    const testResult = await LLMProvider.testConnection();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      llmProvider: testResult ? 'available' : 'limited',
      stats: {
        totalQueries: stats.totalQueries,
        todayQueries: stats.todayQueries,
        successRate: `${stats.successRate.toFixed(1)}%`
      }
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

export { router as promptRouter };