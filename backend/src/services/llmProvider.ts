import { createLogger } from '../utils/logger';
import { safeFetch } from '../middleware/urlValidation';

interface LLMResponse {
  improvedPrompt: string;
  usage?: {
    tokens: number;
    cost: number;
  };
}

interface ProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class LLMProvider {
  private static readonly logger = createLogger();
  
  private static readonly OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
  private static readonly ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  
  private static readonly configs: Record<string, ProviderConfig> = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307'
    },
    local: {
      apiKey: process.env.LOCAL_API_KEY || '',
      baseUrl: process.env.LOCAL_API_URL || 'http://localhost:1234',
      model: process.env.LOCAL_MODEL || 'local'
    }
  };

  static async improvePrompt(
    originalPrompt: string,
    provider: 'openai' | 'anthropic' | 'local' = 'openai',
    language?: string
  ): Promise<LLMResponse> {
    
    // Input sanitization
    if (!originalPrompt || originalPrompt.trim().length === 0) {
      throw new Error('Prompt text cannot be empty');
    }
    
    if (originalPrompt.length > 10000) {
      throw new Error('Prompt text too long (max 10,000 characters)');
    }

    try {
      switch (provider) {
        case 'openai':
          return await this.improveWithOpenAI(originalPrompt, language);
        case 'anthropic':
          return await this.improveWithAnthropic(originalPrompt, language);
        case 'local':
          return await this.improveWithLocal(originalPrompt, language);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      this.logger.error(`LLM provider error (${provider}):`, {
        error: error.message,
        provider,
        promptLength: originalPrompt.length
      });
      
      // Fallback to offline improvement
      return this.improveWithOfflineRules(originalPrompt, language);
    }
  }

  private static async improveWithOpenAI(prompt: string, language?: string): Promise<LLMResponse> {
    const config = this.configs.openai;
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(language);
    
    const requestBody = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    };

    const response = await safeFetch(this.OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI');
    }

    const improvedPrompt = data.choices[0].message.content.trim();
    const tokensUsed = data.usage?.total_tokens || 0;
    const cost = this.calculateOpenAICost(tokensUsed, config.model || 'gpt-3.5-turbo');

    return {
      improvedPrompt,
      usage: { tokens: tokensUsed, cost }
    };
  }

  private static async improveWithAnthropic(prompt: string, language?: string): Promise<LLMResponse> {
    const config = this.configs.anthropic;
    
    if (!config.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(language);
    
    const requestBody = {
      model: config.model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    const response = await safeFetch(this.ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.content || data.content.length === 0) {
      throw new Error('No response from Anthropic');
    }

    const improvedPrompt = data.content[0].text.trim();
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = this.calculateAnthropicCost(inputTokens, outputTokens);

    return {
      improvedPrompt,
      usage: { tokens: inputTokens + outputTokens, cost }
    };
  }

  private static async improveWithLocal(prompt: string, language?: string): Promise<LLMResponse> {
    const config = this.configs.local;
    
    if (!config.baseUrl) {
      throw new Error('Local API URL not configured');
    }

    const systemPrompt = this.buildSystemPrompt(language);
    
    const requestBody = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    };

    const response = await safeFetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from local API');
    }

    const improvedPrompt = data.choices[0].message.content.trim();

    return {
      improvedPrompt,
      usage: { tokens: 0, cost: 0 } // Local is free
    };
  }

  private static improveWithOfflineRules(prompt: string, language?: string): LLMResponse {
    // Fallback offline improvement using rule-based approach
    let improved = prompt;
    
    // Basic improvements
    if (improved.match(/^(help|write|create|make|do)\s/i)) {
      improved = improved.replace(/^(help|write|create|make|do)\s/i, 'I need you to ');
    }
    
    // Add persona for code-related prompts
    if (improved.toLowerCase().includes('code') || improved.toLowerCase().includes('function')) {
      improved = `Act as an expert software engineer.\n\n${improved}`;
    }
    
    // Add structure for short prompts
    if (prompt.length < 50) {
      improved += '\n\nPlease provide a detailed response with examples and explanations.';
    }
    
    // Add language instruction if detected
    if (language && language !== 'en') {
      const langNames = {
        'es': 'Spanish',
        'fr': 'French', 
        'de': 'German',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'pt': 'Portuguese'
      };
      const langName = langNames[language as keyof typeof langNames] || language;
      improved = `Please respond in ${langName}.\n\n${improved}`;
    }

    this.logger.info('Using offline fallback for prompt improvement');

    return {
      improvedPrompt: improved,
      usage: { tokens: 0, cost: 0 }
    };
  }

  private static buildSystemPrompt(language?: string): string {
    const langInstruction = language && language !== 'en' 
      ? `Please respond in the user's language (${language}).` 
      : '';

    return `You are an expert prompt engineer. Your job is to improve prompts for better AI interactions.

Guidelines:
1. Make prompts clearer and more specific
2. Add appropriate expert persona when helpful
3. Suggest output format when relevant  
4. Add concrete examples if needed
5. Maintain the user's intent and tone
6. Keep improvements concise and practical
${langInstruction}

Respond with only the improved prompt, no explanation or commentary.`;
  }

  private static calculateOpenAICost(tokens: number, model: string): number {
    const pricing: Record<string, number> = {
      'gpt-3.5-turbo': 0.002 / 1000,     // $0.002 per 1K tokens
      'gpt-4': 0.03 / 1000,              // $0.03 per 1K tokens  
      'gpt-4-turbo': 0.01 / 1000,        // $0.01 per 1K tokens
      'gpt-4o-mini': 0.00015 / 1000      // $0.00015 per 1K tokens
    };
    
    return tokens * (pricing[model] || pricing['gpt-3.5-turbo']);
  }

  private static calculateAnthropicCost(inputTokens: number, outputTokens: number): number {
    // Claude 3 Haiku pricing (as of 2024)
    const inputCost = inputTokens * (0.00025 / 1000);   // $0.25 per 1M input tokens
    const outputCost = outputTokens * (0.00125 / 1000); // $1.25 per 1M output tokens
    
    return inputCost + outputCost;
  }

  static async testConnection(): Promise<boolean> {
    try {
      // Try each provider in order of preference
      const providers: Array<'openai' | 'anthropic' | 'local'> = ['openai', 'anthropic', 'local'];
      
      for (const provider of providers) {
        try {
          const result = await this.improvePrompt('Test', provider);
          if (result.improvedPrompt) {
            this.logger.info(`LLM provider test successful: ${provider}`);
            return true;
          }
        } catch (error) {
          this.logger.warn(`LLM provider test failed: ${provider}`, { error });
          continue;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error('LLM provider test error', { error });
      return false;
    }
  }

  static getProviderStatus(): Record<string, boolean> {
    return {
      openai: !!this.configs.openai.apiKey,
      anthropic: !!this.configs.anthropic.apiKey,
      local: !!this.configs.local.baseUrl
    };
  }

  static async getEstimatedCost(prompt: string, provider: 'openai' | 'anthropic' | 'local'): Promise<number> {
    // Rough estimation based on prompt length
    const estimatedTokens = Math.ceil(prompt.length / 4) * 1.5; // Input + output estimation
    
    switch (provider) {
      case 'openai':
        return this.calculateOpenAICost(estimatedTokens, this.configs.openai.model || 'gpt-3.5-turbo');
      case 'anthropic':
        return this.calculateAnthropicCost(estimatedTokens * 0.6, estimatedTokens * 0.4);
      case 'local':
        return 0;
      default:
        return 0;
    }
  }
}