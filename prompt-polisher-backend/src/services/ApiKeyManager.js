const { ApiKey } = require('../models');
const crypto = require('crypto');
const logger = require('../utils/logger');

class ApiKeyManager {
  constructor() {
    this.keyCache = new Map();
    this.lastCacheUpdate = new Date();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get an active API key for a specific provider
   * Uses round-robin selection with cost limits
   */
  async getActiveKey(provider) {
    try {
      const keys = await this.getActiveKeysForProvider(provider);
      
      if (keys.length === 0) {
        throw new Error(`No active API keys available for provider: ${provider}`);
      }

      // Filter out keys that have exceeded daily limits
      const availableKeys = keys.filter(key => !key.hasExceededDailyLimit());
      
      if (availableKeys.length === 0) {
        logger.warn(`All API keys for ${provider} have exceeded daily limits`);
        throw new Error(`Daily API cost limit exceeded for provider: ${provider}`);
      }

      // Simple round-robin selection (could be enhanced with weighted selection)
      const selectedKey = this.selectKeyRoundRobin(availableKeys);
      
      return selectedKey;
    } catch (error) {
      logger.error('Error getting active API key:', error);
      throw error;
    }
  }

  /**
   * Get all active keys for a provider
   */
  async getActiveKeysForProvider(provider) {
    const cacheKey = `keys_${provider}`;
    
    // Check cache first
    if (this.shouldUseCache()) {
      const cachedKeys = this.keyCache.get(cacheKey);
      if (cachedKeys) {
        return cachedKeys;
      }
    }

    // Fetch from database
    const keys = await ApiKey.findAll({
      where: {
        provider,
        is_active: true
      },
      order: [['last_used', 'ASC']] // Prefer least recently used
    });

    // Update cache
    this.keyCache.set(cacheKey, keys);
    this.lastCacheUpdate = new Date();

    return keys;
  }

  /**
   * Select key using round-robin strategy
   */
  selectKeyRoundRobin(keys) {
    // Find the key with the oldest last_used timestamp
    return keys.reduce((oldest, current) => {
      if (!oldest.last_used) return current;
      if (!current.last_used) return oldest;
      return oldest.last_used < current.last_used ? oldest : current;
    });
  }

  /**
   * Record API key usage and cost
   */
  async recordUsage(keyId, cost = 0) {
    try {
      const key = await ApiKey.findByPk(keyId);
      if (!key) {
        throw new Error(`API key not found: ${keyId}`);
      }

      key.incrementUsage();
      if (cost > 0) {
        key.addCost(cost);
      }

      await key.save();
      
      // Clear cache to ensure fresh data
      this.clearCache();
      
      logger.info(`API key usage recorded: ${key.key_prefix}... Cost: $${cost}`);
    } catch (error) {
      logger.error('Error recording API key usage:', error);
      throw error;
    }
  }

  /**
   * Add a new API key
   */
  async addKey(provider, plainKey, dailyLimit = 50.00, notes = '') {
    try {
      // Check if key already exists
      const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
      const existingKey = await ApiKey.findOne({ where: { key_hash: keyHash } });
      
      if (existingKey) {
        throw new Error('API key already exists');
      }

      const apiKey = await ApiKey.create({
        provider,
        daily_cost_limit: dailyLimit,
        notes
      });

      apiKey.setKey(plainKey);
      await apiKey.save();

      this.clearCache();
      
      logger.info(`New API key added for ${provider}: ${apiKey.key_prefix}...`);
      return apiKey;
    } catch (error) {
      logger.error('Error adding API key:', error);
      throw error;
    }
  }

  /**
   * Rotate API key (mark old as inactive, add new)
   */
  async rotateKey(keyId, newPlainKey) {
    try {
      const oldKey = await ApiKey.findByPk(keyId);
      if (!oldKey) {
        throw new Error(`API key not found: ${keyId}`);
      }

      // Mark old key as inactive
      oldKey.is_active = false;
      oldKey.rotation_date = new Date();
      await oldKey.save();

      // Add new key
      const newKey = await this.addKey(
        oldKey.provider,
        newPlainKey,
        oldKey.daily_cost_limit,
        `Rotated from ${oldKey.key_prefix}...`
      );

      this.clearCache();
      
      logger.info(`API key rotated: ${oldKey.key_prefix}... -> ${newKey.key_prefix}...`);
      return newKey;
    } catch (error) {
      logger.error('Error rotating API key:', error);
      throw error;
    }
  }

  /**
   * Deactivate API key
   */
  async deactivateKey(keyId, reason = '') {
    try {
      const key = await ApiKey.findByPk(keyId);
      if (!key) {
        throw new Error(`API key not found: ${keyId}`);
      }

      key.is_active = false;
      key.notes = key.notes ? `${key.notes}\nDeactivated: ${reason}` : `Deactivated: ${reason}`;
      await key.save();

      this.clearCache();
      
      logger.warn(`API key deactivated: ${key.key_prefix}... Reason: ${reason}`);
    } catch (error) {
      logger.error('Error deactivating API key:', error);
      throw error;
    }
  }

  /**
   * Get API key statistics
   */
  async getKeyStats(provider = null) {
    try {
      const where = provider ? { provider } : {};
      
      const keys = await ApiKey.findAll({
        where,
        attributes: [
          'id',
          'provider',
          'key_prefix',
          'is_active',
          'usage_count',
          'last_used',
          'daily_cost_limit',
          'current_daily_cost',
          'cost_reset_date'
        ]
      });

      return keys.map(key => ({
        id: key.id,
        provider: key.provider,
        prefix: key.key_prefix,
        isActive: key.is_active,
        usageCount: key.usage_count,
        lastUsed: key.last_used,
        dailyLimit: parseFloat(key.daily_cost_limit),
        currentCost: parseFloat(key.current_daily_cost),
        costResetDate: key.cost_reset_date,
        utilizationPercent: (parseFloat(key.current_daily_cost) / parseFloat(key.daily_cost_limit)) * 100
      }));
    } catch (error) {
      logger.error('Error getting key statistics:', error);
      throw error;
    }
  }

  /**
   * Check if we should use cached keys
   */
  shouldUseCache() {
    return (new Date() - this.lastCacheUpdate) < this.CACHE_TTL;
  }

  /**
   * Clear the key cache
   */
  clearCache() {
    this.keyCache.clear();
    this.lastCacheUpdate = new Date(0);
  }

  /**
   * Validate API key format
   */
  static validateKeyFormat(provider, key) {
    const patterns = {
      openai: /^sk-[a-zA-Z0-9]{48,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
      google: /^[a-zA-Z0-9-_]{39}$/
    };

    const pattern = patterns[provider];
    if (!pattern) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!pattern.test(key)) {
      throw new Error(`Invalid API key format for ${provider}`);
    }

    return true;
  }
}

module.exports = new ApiKeyManager();