const crypto = require('crypto');
const User = require('../models/User');
const Usage = require('../models/Usage');
const logger = require('../utils/logger');

class ApiKeyService {
  // Generate new API key
  generateApiKey() {
    const prefix = 'sk_';
    const randomBytes = crypto.randomBytes(32);
    const apiKey = prefix + randomBytes.toString('hex');
    return apiKey;
  }

  // Create new API key for user
  async createApiKey(userId, name) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user has reached API key limit
      const activeKeys = user.apiKeys.filter(key => key.isActive);
      if (activeKeys.length >= 5) { // Limit to 5 active keys per user
        throw new Error('Maximum API key limit reached');
      }

      const apiKey = this.generateApiKey();
      
      user.apiKeys.push({
        key: apiKey,
        name: name || `API Key ${activeKeys.length + 1}`,
        isActive: true,
        createdAt: new Date(),
        usageCount: 0
      });

      await user.save();

      logger.info(`Created API key for user ${userId}`);

      return {
        apiKey,
        name: name || `API Key ${activeKeys.length + 1}`,
        createdAt: new Date()
      };
    } catch (error) {
      logger.error('Error creating API key:', error);
      throw error;
    }
  }

  // Rotate API key
  async rotateApiKey(userId, oldApiKey) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const keyIndex = user.apiKeys.findIndex(key => key.key === oldApiKey && key.isActive);
      if (keyIndex === -1) {
        throw new Error('API key not found or inactive');
      }

      const oldKeyData = user.apiKeys[keyIndex];
      const newApiKey = this.generateApiKey();

      // Deactivate old key
      user.apiKeys[keyIndex].isActive = false;
      user.apiKeys[keyIndex].rotatedAt = new Date();

      // Create new key
      user.apiKeys.push({
        key: newApiKey,
        name: oldKeyData.name + ' (Rotated)',
        isActive: true,
        createdAt: new Date(),
        usageCount: 0,
        rotatedFrom: oldApiKey
      });

      await user.save();

      logger.info(`Rotated API key for user ${userId}`);

      return {
        newApiKey,
        oldApiKey,
        name: oldKeyData.name + ' (Rotated)'
      };
    } catch (error) {
      logger.error('Error rotating API key:', error);
      throw error;
    }
  }

  // Deactivate API key
  async deactivateApiKey(userId, apiKey) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const keyIndex = user.apiKeys.findIndex(key => key.key === apiKey);
      if (keyIndex === -1) {
        throw new Error('API key not found');
      }

      user.apiKeys[keyIndex].isActive = false;
      user.apiKeys[keyIndex].deactivatedAt = new Date();

      await user.save();

      logger.info(`Deactivated API key for user ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error deactivating API key:', error);
      throw error;
    }
  }

  // Validate API key and return user
  async validateApiKey(apiKey) {
    try {
      const user = await User.findByApiKey(apiKey);
      if (!user) {
        return { valid: false, error: 'Invalid API key' };
      }

      // Check if user account is active
      if (!user.isActive) {
        return { valid: false, error: 'Account deactivated' };
      }

      // Check if account is locked
      if (user.isAccountLocked) {
        return { valid: false, error: 'Account locked due to security concerns' };
      }

      // Check usage limits
      const usageCheck = await this.checkUsageLimits(user);
      if (!usageCheck.allowed) {
        return { valid: false, error: usageCheck.reason };
      }

      // Update last used timestamp and usage count
      await this.updateApiKeyUsage(user._id, apiKey);

      return {
        valid: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
          usage: user.usage,
          remainingQueries: user.usage.remainingQueries
        }
      };
    } catch (error) {
      logger.error('Error validating API key:', error);
      return { valid: false, error: 'Internal server error' };
    }
  }

  // Check usage limits
  async checkUsageLimits(user) {
    try {
      // For subscription users, no query limits
      if (user.subscription.type === 'monthly' || user.subscription.type === 'yearly') {
        if (user.subscription.status === 'active') {
          return { allowed: true };
        } else {
          return { allowed: false, reason: 'Subscription inactive' };
        }
      }

      // For free tier users, check remaining queries
      if (user.usage.remainingQueries <= 0) {
        return { allowed: false, reason: 'Query limit exceeded. Please upgrade your plan.' };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking usage limits:', error);
      return { allowed: false, reason: 'Error checking limits' };
    }
  }

  // Update API key usage
  async updateApiKeyUsage(userId, apiKey) {
    try {
      await User.updateOne(
        {
          _id: userId,
          'apiKeys.key': apiKey
        },
        {
          $set: {
            'apiKeys.$.lastUsed': new Date()
          },
          $inc: {
            'apiKeys.$.usageCount': 1
          }
        }
      );
    } catch (error) {
      logger.error('Error updating API key usage:', error);
    }
  }

  // Get API key usage statistics
  async getApiKeyUsageStats(userId, apiKey, startDate, endDate) {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const stats = await Usage.aggregate([
        {
          $match: {
            user: userId,
            apiKey: apiKey,
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' }
            },
            totalRequests: { $sum: 1 },
            totalCost: { $sum: '$cost' },
            avgResponseTime: { $avg: '$responseTime' },
            errorCount: {
              $sum: {
                $cond: [{ $gte: ['$responseStatus', 400] }, 1, 0]
              }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
      ]);

      // Get endpoint breakdown
      const endpointStats = await Usage.aggregate([
        {
          $match: {
            user: userId,
            apiKey: apiKey,
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: '$endpoint',
            requests: { $sum: 1 },
            cost: { $sum: '$cost' },
            avgResponseTime: { $avg: '$responseTime' }
          }
        },
        {
          $sort: { requests: -1 }
        }
      ]);

      return {
        dailyStats: stats,
        endpointStats,
        period: { startDate: start, endDate: end }
      };
    } catch (error) {
      logger.error('Error getting API key usage stats:', error);
      throw error;
    }
  }

  // Get all API keys for user
  async getUserApiKeys(userId) {
    try {
      const user = await User.findById(userId).select('apiKeys');
      if (!user) {
        throw new Error('User not found');
      }

      // Return API keys with sensitive information masked
      const apiKeys = user.apiKeys.map(key => ({
        id: key._id,
        name: key.name,
        key: key.isActive ? this.maskApiKey(key.key) : 'Inactive',
        isActive: key.isActive,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount,
        rotatedAt: key.rotatedAt,
        deactivatedAt: key.deactivatedAt
      }));

      return apiKeys;
    } catch (error) {
      logger.error('Error getting user API keys:', error);
      throw error;
    }
  }

  // Mask API key for display
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return apiKey;
    const prefix = apiKey.substring(0, 3);
    const suffix = apiKey.substring(apiKey.length - 4);
    const masked = '*'.repeat(apiKey.length - 7);
    return prefix + masked + suffix;
  }

  // Admin: Get all API keys with usage
  async getAllApiKeysWithUsage(page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      const apiKeys = await User.aggregate([
        { $unwind: '$apiKeys' },
        {
          $lookup: {
            from: 'usages',
            let: { apiKey: '$apiKeys.key' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$apiKey', '$$apiKey'] },
                  timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
              },
              {
                $group: {
                  _id: null,
                  totalRequests: { $sum: 1 },
                  totalCost: { $sum: '$cost' },
                  lastUsed: { $max: '$timestamp' }
                }
              }
            ],
            as: 'recentUsage'
          }
        },
        {
          $project: {
            userId: '$_id',
            userEmail: '$email',
            userName: '$name',
            keyId: '$apiKeys._id',
            keyName: '$apiKeys.name',
            key: '$apiKeys.key',
            isActive: '$apiKeys.isActive',
            createdAt: '$apiKeys.createdAt',
            lastUsed: '$apiKeys.lastUsed',
            usageCount: '$apiKeys.usageCount',
            recentRequests: { $ifNull: [{ $arrayElemAt: ['$recentUsage.totalRequests', 0] }, 0] },
            recentCost: { $ifNull: [{ $arrayElemAt: ['$recentUsage.totalCost', 0] }, 0] },
            lastActivity: { $ifNull: [{ $arrayElemAt: ['$recentUsage.lastUsed', 0] }, '$apiKeys.lastUsed'] }
          }
        },
        { $sort: { lastActivity: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]);

      const total = await User.aggregate([
        { $unwind: '$apiKeys' },
        { $count: 'total' }
      ]);

      return {
        apiKeys,
        pagination: {
          page,
          limit,
          total: total[0]?.total || 0,
          pages: Math.ceil((total[0]?.total || 0) / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting all API keys:', error);
      throw error;
    }
  }

  // Detect suspicious API key activity
  async detectSuspiciousActivity(apiKey, requestData) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent usage for this API key
      const [hourlyUsage, dailyUsage] = await Promise.all([
        Usage.countDocuments({
          apiKey,
          timestamp: { $gte: oneHourAgo }
        }),
        Usage.countDocuments({
          apiKey,
          timestamp: { $gte: oneDayAgo }
        })
      ]);

      const suspiciousActivity = [];

      // Check for unusual volume
      if (hourlyUsage > 1000) {
        suspiciousActivity.push({
          type: 'high_volume',
          severity: 'high',
          description: `Unusually high volume: ${hourlyUsage} requests in the last hour`,
          metadata: { hourlyUsage }
        });
      }

      // Check for rapid requests from same IP
      if (requestData.ip) {
        const ipUsage = await Usage.countDocuments({
          apiKey,
          'metadata.ipAddress': requestData.ip,
          timestamp: { $gte: oneHourAgo }
        });

        if (ipUsage > 500) {
          suspiciousActivity.push({
            type: 'ip_abuse',
            severity: 'medium',
            description: `High request volume from single IP: ${requestData.ip}`,
            metadata: { ip: requestData.ip, count: ipUsage }
          });
        }
      }

      // Check for error rate
      const errorCount = await Usage.countDocuments({
        apiKey,
        responseStatus: { $gte: 400 },
        timestamp: { $gte: oneHourAgo }
      });

      const errorRate = hourlyUsage > 0 ? (errorCount / hourlyUsage) : 0;
      if (errorRate > 0.5) { // More than 50% errors
        suspiciousActivity.push({
          type: 'high_error_rate',
          severity: 'medium',
          description: `High error rate: ${Math.round(errorRate * 100)}%`,
          metadata: { errorRate, errorCount, totalRequests: hourlyUsage }
        });
      }

      return suspiciousActivity;
    } catch (error) {
      logger.error('Error detecting suspicious API key activity:', error);
      return [];
    }
  }

  // Admin: Force rotate all API keys for a user
  async forceRotateUserApiKeys(userId, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const rotatedKeys = [];

      for (const key of user.apiKeys) {
        if (key.isActive) {
          const newApiKey = this.generateApiKey();
          
          // Deactivate old key
          key.isActive = false;
          key.rotatedAt = new Date();
          key.rotationReason = reason;

          // Create new key
          user.apiKeys.push({
            key: newApiKey,
            name: key.name + ' (Force Rotated)',
            isActive: true,
            createdAt: new Date(),
            usageCount: 0,
            rotatedFrom: key.key
          });

          rotatedKeys.push({
            oldKey: this.maskApiKey(key.key),
            newKey: newApiKey,
            name: key.name
          });
        }
      }

      await user.save();

      logger.info(`Force rotated ${rotatedKeys.length} API keys for user ${userId}. Reason: ${reason}`);

      return rotatedKeys;
    } catch (error) {
      logger.error('Error force rotating API keys:', error);
      throw error;
    }
  }
}

module.exports = new ApiKeyService();