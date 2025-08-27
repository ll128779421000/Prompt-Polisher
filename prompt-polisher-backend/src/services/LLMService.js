const axios = require('axios');
const ApiKeyManager = require('./ApiKeyManager');
const { ApiUsage } = require('../models');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    this.providers = {
      openai: {
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-3.5-turbo',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview'],
        pricing: {
          'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }, // per 1K tokens
          'gpt-4': { input: 0.03, output: 0.06 },
          'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }
        }
      },
      anthropic: {
        baseURL: 'https://api.anthropic.com',
        defaultModel: 'claude-3-sonnet-20240229',
        models: ['claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
        pricing: {
          'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
          'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
          'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
        }
      },
      google: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        defaultModel: 'gemini-pro',
        models: ['gemini-pro', 'gemini-pro-vision'],
        pricing: {
          'gemini-pro': { input: 0.0005, output: 0.0015 },
          'gemini-pro-vision': { input: 0.0025, output: 0.0075 }
        }
      }
    };
  }

  /**
   * Process prompt with specified LLM provider
   */
  async processPrompt(provider, model, prompt, options = {}) {
    const startTime = Date.now();
    let apiKey = null;
    
    try {
      // Get API key for provider
      apiKey = await ApiKeyManager.getActiveKey(provider);
      
      // Validate provider and model
      if (!this.providers[provider]) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      const providerConfig = this.providers[provider];
      if (!providerConfig.models.includes(model)) {
        model = providerConfig.defaultModel;
      }

      // Process request based on provider
      let response;
      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(apiKey, model, prompt, options);
          break;
        case 'anthropic':
          response = await this.callAnthropic(apiKey, model, prompt, options);
          break;
        case 'google':
          response = await this.callGoogle(apiKey, model, prompt, options);
          break;
        default:
          throw new Error(`Provider ${provider} not implemented`);
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Calculate cost
      const cost = this.calculateCost(provider, model, response.usage);

      // Record API key usage
      await ApiKeyManager.recordUsage(apiKey.id, cost);

      return {
        ...response,
        responseTime,
        cost,
        provider,
        model
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`LLM API error for ${provider}:`, error);
      
      // If API key exceeded limits, mark it for rotation
      if (error.response?.status === 429 && apiKey) {
        await ApiKeyManager.deactivateKey(apiKey.id, 'Rate limit exceeded');
      }

      throw {
        ...error,
        responseTime,
        provider,
        model
      };
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(apiKey, model, prompt, options = {}) {
    try {
      const requestData = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0
      };

      const response = await axios.post(
        `${this.providers.openai.baseURL}/chat/completions`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return {
        content: response.data.choices[0].message.content,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        },
        finishReason: response.data.choices[0].finish_reason
      };
    } catch (error) {
      this.handleAPIError('openai', error);
    }
  }

  /**
   * Call Anthropic API
   */
  async callAnthropic(apiKey, model, prompt, options = {}) {
    try {
      const requestData = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1
      };

      const response = await axios.post(
        `${this.providers.anthropic.baseURL}/v1/messages`,
        requestData,
        {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        }
      );

      return {
        content: response.data.content[0].text,
        usage: {
          promptTokens: response.data.usage.input_tokens,
          completionTokens: response.data.usage.output_tokens,
          totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
        },
        finishReason: response.data.stop_reason
      };
    } catch (error) {
      this.handleAPIError('anthropic', error);
    }
  }

  /**
   * Call Google Gemini API
   */
  async callGoogle(apiKey, model, prompt, options = {}) {
    try {
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topP: options.topP || 1,
          maxOutputTokens: options.maxTokens || 1000
        }
      };

      const response = await axios.post(
        `${this.providers.google.baseURL}/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const candidate = response.data.candidates[0];
      return {
        content: candidate.content.parts[0].text,
        usage: {
          promptTokens: response.data.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.data.usageMetadata?.totalTokenCount || 0
        },
        finishReason: candidate.finishReason
      };
    } catch (error) {
      this.handleAPIError('google', error);
    }
  }

  /**
   * Calculate API usage cost
   */
  calculateCost(provider, model, usage) {
    const pricing = this.providers[provider]?.pricing[model];
    if (!pricing || !usage) return 0;

    const inputCost = (usage.promptTokens / 1000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000) * pricing.output;
    
    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Record API usage for analytics
   */
  async recordUsage(req, provider, model, usage, cost, responseTime, statusCode, errorMessage = null) {
    try {
      const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
      const userAgent = req.get('User-Agent') || '';
      const referer = req.get('Referer') || '';

      await ApiUsage.create({
        user_id: req.user?.id || null,
        ip_address: ip,
        endpoint: req.route?.path || req.path,
        llm_provider: provider,
        model_used: model,
        prompt_tokens: usage?.promptTokens || 0,
        completion_tokens: usage?.completionTokens || 0,
        total_tokens: usage?.totalTokens || 0,
        cost_usd: cost || 0,
        response_time_ms: responseTime || 0,
        status_code: statusCode,
        error_message: errorMessage,
        user_agent: userAgent,
        referer: referer
      });
    } catch (error) {
      logger.error('Error recording API usage:', error);
    }
  }

  /**
   * Handle API errors consistently
   */
  handleAPIError(provider, error) {
    let statusCode = 500;
    let message = `${provider} API error`;

    if (error.response) {
      statusCode = error.response.status;
      message = error.response.data?.error?.message || error.response.data?.message || message;
    } else if (error.request) {
      statusCode = 503;
      message = `${provider} API unavailable`;
    }

    const apiError = new Error(message);
    apiError.statusCode = statusCode;
    apiError.provider = provider;
    apiError.response = error.response;
    
    throw apiError;
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider) {
    return this.providers[provider]?.models || [];
  }

  /**
   * Get all supported providers
   */
  getSupportedProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Validate prompt parameters
   */
  validatePromptParams(provider, model, prompt, options = {}) {
    if (!provider || !this.providers[provider]) {
      throw new Error('Invalid or missing provider');
    }

    if (!model || !this.providers[provider].models.includes(model)) {
      throw new Error('Invalid or missing model for provider');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    if (prompt.length > 32000) {
      throw new Error('Prompt is too long (maximum 32,000 characters)');
    }

    // Validate options
    if (options.maxTokens && (options.maxTokens < 1 || options.maxTokens > 4000)) {
      throw new Error('maxTokens must be between 1 and 4000');
    }

    if (options.temperature && (options.temperature < 0 || options.temperature > 2)) {
      throw new Error('temperature must be between 0 and 2');
    }

    return true;
  }
}

module.exports = new LLMService();