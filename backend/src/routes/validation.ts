import express from 'express';
import { body, validationResult } from 'express-validator';
import { LLMProvider } from '../services/llmProvider';
import { createLogger } from '../utils/logger';
import Stripe from 'stripe';

const router = express.Router();
const logger = createLogger();

// Validate OpenAI API Key
router.post('/openai-key',
  body('apiKey').isLength({ min: 20 }).matches(/^sk-[a-zA-Z0-9]+$/).withMessage('Invalid OpenAI API key format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          valid: false,
          error: 'Invalid API key format',
          details: errors.array()
        });
      }

      const { apiKey } = req.body;

      // Test the API key with a minimal request
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Perfect-AI-Prompts/1.0'
        }
      });

      if (testResponse.ok) {
        const data = await testResponse.json();
        const availableModels = data.data?.map((model: any) => model.id) || [];
        
        // Check if GPT models are available
        const hasGPT35 = availableModels.some((id: string) => id.includes('gpt-3.5'));
        const hasGPT4 = availableModels.some((id: string) => id.includes('gpt-4'));
        
        logger.info('OpenAI API key validated successfully', {
          hasGPT35,
          hasGPT4,
          modelCount: availableModels.length
        });

        res.json({
          valid: true,
          provider: 'openai',
          models: {
            'gpt-3.5-turbo': hasGPT35,
            'gpt-4': hasGPT4,
            'gpt-4-turbo': hasGPT4
          },
          recommendedModel: hasGPT35 ? 'gpt-3.5-turbo' : (hasGPT4 ? 'gpt-4' : null),
          estimatedCostPer1000Tokens: hasGPT35 ? 0.002 : (hasGPT4 ? 0.03 : 0.002)
        });
      } else {
        const errorData = await testResponse.text();
        logger.warn('OpenAI API key validation failed', {
          status: testResponse.status,
          error: errorData
        });

        res.json({
          valid: false,
          error: 'API key authentication failed',
          details: testResponse.status === 401 ? 'Invalid API key' : 'API request failed'
        });
      }

    } catch (error: any) {
      logger.error('OpenAI API key validation error', {
        error: error.message
      });

      res.json({
        valid: false,
        error: 'Connection failed',
        details: 'Unable to connect to OpenAI API'
      });
    }
  }
);

// Validate Anthropic API Key
router.post('/anthropic-key',
  body('apiKey').isLength({ min: 20 }).matches(/^sk-ant-[a-zA-Z0-9\-_]+$/).withMessage('Invalid Anthropic API key format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          valid: false,
          error: 'Invalid API key format',
          details: errors.array()
        });
      }

      const { apiKey } = req.body;

      // Test the API key with a minimal completion request
      const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'Perfect-AI-Prompts/1.0'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (testResponse.ok) {
        const data = await testResponse.json();
        
        logger.info('Anthropic API key validated successfully', {
          model: 'claude-3-haiku-20240307',
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0
        });

        res.json({
          valid: true,
          provider: 'anthropic',
          models: {
            'claude-3-haiku-20240307': true,
            'claude-3-sonnet-20240229': true,
            'claude-3-opus-20240229': true
          },
          recommendedModel: 'claude-3-haiku-20240307',
          estimatedCostPer1000Tokens: 0.00025 // Input tokens
        });
      } else {
        const errorData = await testResponse.text();
        logger.warn('Anthropic API key validation failed', {
          status: testResponse.status,
          error: errorData
        });

        res.json({
          valid: false,
          error: 'API key authentication failed',
          details: testResponse.status === 401 ? 'Invalid API key' : 'API request failed'
        });
      }

    } catch (error: any) {
      logger.error('Anthropic API key validation error', {
        error: error.message
      });

      res.json({
        valid: false,
        error: 'Connection failed',
        details: 'Unable to connect to Anthropic API'
      });
    }
  }
);

// Validate Stripe API Key
router.post('/stripe-key',
  body('apiKey').isLength({ min: 20 }).matches(/^sk_(test_|live_)[a-zA-Z0-9]+$/).withMessage('Invalid Stripe API key format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          valid: false,
          error: 'Invalid API key format',
          details: errors.array()
        });
      }

      const { apiKey } = req.body;
      const isLiveMode = apiKey.startsWith('sk_live_');

      try {
        const stripe = new Stripe(apiKey, {
          apiVersion: '2023-10-16',
        });

        // Test the key by retrieving account information
        const account = await stripe.accounts.retrieve();
        
        logger.info('Stripe API key validated successfully', {
          isLiveMode,
          country: account.country,
          accountId: account.id
        });

        res.json({
          valid: true,
          provider: 'stripe',
          mode: isLiveMode ? 'live' : 'test',
          country: account.country,
          accountId: account.id,
          capabilities: {
            payments: account.capabilities?.card_payments === 'active',
            transfers: account.capabilities?.transfers === 'active'
          },
          recommendation: isLiveMode 
            ? 'Live mode detected - ready for production payments'
            : 'Test mode - perfect for development and testing'
        });

      } catch (stripeError: any) {
        logger.warn('Stripe API key validation failed', {
          error: stripeError.message,
          type: stripeError.type
        });

        res.json({
          valid: false,
          error: 'Stripe authentication failed',
          details: stripeError.message
        });
      }

    } catch (error: any) {
      logger.error('Stripe API key validation error', {
        error: error.message
      });

      res.json({
        valid: false,
        error: 'Validation failed',
        details: error.message
      });
    }
  }
);

// Test Local LLM Connection
router.post('/local-llm',
  body('baseUrl').isURL().withMessage('Invalid base URL'),
  body('apiKey').optional().isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          valid: false,
          error: 'Invalid parameters',
          details: errors.array()
        });
      }

      const { baseUrl, apiKey, model } = req.body;

      // Test connection with a simple completion request
      const testResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        },
        body: JSON.stringify({
          model: model || 'local',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5,
          temperature: 0
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (testResponse.ok) {
        const data = await testResponse.json();
        
        logger.info('Local LLM connection validated successfully', {
          baseUrl,
          model: model || 'local',
          hasResponse: !!data.choices?.[0]?.message?.content
        });

        res.json({
          valid: true,
          provider: 'local',
          baseUrl,
          model: model || 'local',
          responseTime: testResponse.headers.get('x-response-time') || 'unknown',
          estimatedCostPer1000Tokens: 0,
          recommendation: 'Local LLM is working - cost-effective option!'
        });
      } else {
        const errorData = await testResponse.text();
        logger.warn('Local LLM connection failed', {
          baseUrl,
          status: testResponse.status,
          error: errorData
        });

        res.json({
          valid: false,
          error: 'Local LLM connection failed',
          details: `HTTP ${testResponse.status}: ${errorData}`
        });
      }

    } catch (error: any) {
      logger.error('Local LLM validation error', {
        error: error.message
      });

      res.json({
        valid: false,
        error: 'Connection failed',
        details: error.message.includes('timeout') 
          ? 'Connection timeout - check if local LLM server is running'
          : 'Unable to connect to local LLM'
      });
    }
  }
);

// Comprehensive system test
router.post('/system-test', async (req, res) => {
  try {
    const results = {
      database: false,
      llmProvider: false,
      stripe: false,
      security: false,
      timestamp: new Date().toISOString()
    };

    // Test database
    try {
      const { Database } = await import('../db/database');
      const stats = await Database.getUsageStats();
      results.database = typeof stats.totalQueries === 'number';
    } catch (error) {
      logger.error('Database test failed', { error });
    }

    // Test LLM provider
    try {
      const testResult = await LLMProvider.testConnection();
      results.llmProvider = testResult;
    } catch (error) {
      logger.error('LLM provider test failed', { error });
    }

    // Test Stripe (if configured)
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2023-10-16',
        });
        await stripe.accounts.retrieve();
        results.stripe = true;
      } catch (error) {
        logger.error('Stripe test failed', { error });
      }
    }

    // Test security headers
    results.security = !!(req.headers['x-frame-options'] || req.secure);

    const overallHealth = Object.values(results).filter(Boolean).length >= 3;

    res.status(overallHealth ? 200 : 503).json({
      healthy: overallHealth,
      results,
      recommendations: {
        database: results.database ? '✅ Database working' : '❌ Database connection failed',
        llmProvider: results.llmProvider ? '✅ LLM provider ready' : '❌ LLM provider unavailable - check API keys',
        stripe: results.stripe ? '✅ Stripe configured' : '⚠️ Stripe not configured - payments disabled',
        security: results.security ? '✅ Security headers active' : '⚠️ Security headers missing'
      }
    });

  } catch (error: any) {
    logger.error('System test failed', { error: error.message });

    res.status(503).json({
      healthy: false,
      error: 'System test failed',
      details: error.message
    });
  }
});

export { router as validationRouter };