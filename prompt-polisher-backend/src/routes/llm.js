const express = require('express');
const router = express.Router();
const LLMService = require('../services/LLMService');
const { authenticateToken, requireAuth } = require('../middleware/security');
const { checkFreeQueryLimit, addRateLimitHeaders } = require('../middleware/rateLimiter');
const { validatePrompt } = require('../middleware/validation');
const { catchAsync } = require('../middleware/errorHandler');

/**
 * Process prompt with LLM
 * POST /api/llm/process
 */
router.post('/process', 
  authenticateToken,
  checkFreeQueryLimit,
  validatePrompt,
  addRateLimitHeaders,
  catchAsync(async (req, res) => {
    const { prompt, provider, model, options = {} } = req.body;
    const startTime = Date.now();
    
    try {
      // Validate parameters
      LLMService.validatePromptParams(provider, model, prompt, options);
      
      // Process the prompt
      const result = await LLMService.processPrompt(provider, model, prompt, options);
      
      // Record usage for analytics
      await LLMService.recordUsage(
        req,
        provider,
        result.model,
        result.usage || {},
        result.cost || 0,
        result.responseTime || 0,
        200
      );
      
      // Response
      res.json({
        success: true,
        data: {
          content: result.content,
          usage: result.usage,
          cost: result.cost,
          responseTime: result.responseTime,
          provider: result.provider,
          model: result.model,
          finishReason: result.finishReason
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record failed usage
      await LLMService.recordUsage(
        req,
        provider,
        model || 'unknown',
        {},
        0,
        responseTime,
        error.statusCode || 500,
        error.message
      );
      
      throw error;
    }
  })
);

/**
 * Get available providers and models
 * GET /api/llm/providers
 */
router.get('/providers', (req, res) => {
  const providers = LLMService.getSupportedProviders().map(provider => ({
    name: provider,
    models: LLMService.getAvailableModels(provider)
  }));
  
  res.json({
    success: true,
    data: { providers }
  });
});

/**
 * Get models for specific provider
 * GET /api/llm/providers/:provider/models
 */
router.get('/providers/:provider/models', (req, res) => {
  const { provider } = req.params;
  const models = LLMService.getAvailableModels(provider);
  
  if (models.length === 0) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Provider not found or no models available',
        code: 'PROVIDER_NOT_FOUND'
      }
    });
  }
  
  res.json({
    success: true,
    data: { 
      provider,
      models 
    }
  });
});

/**
 * Health check for LLM services
 * GET /api/llm/health
 */
router.get('/health', 
  authenticateToken,
  requireAuth,
  catchAsync(async (req, res) => {
    // This endpoint requires authentication to prevent abuse
    const providers = LLMService.getSupportedProviders();
    const health = {};
    
    for (const provider of providers) {
      try {
        // Try a simple test with each provider
        await LLMService.processPrompt(provider, null, 'test', { maxTokens: 1 });
        health[provider] = { status: 'healthy', timestamp: new Date().toISOString() };
      } catch (error) {
        health[provider] = { 
          status: 'unhealthy', 
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    res.json({
      success: true,
      data: { health }
    });
  })
);

module.exports = router;