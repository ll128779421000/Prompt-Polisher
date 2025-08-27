const { ApiUsage, User, Payment, ApiKey, RateLimit } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class AnalyticsService {
  constructor() {
    this.costThresholds = {
      daily: parseFloat(process.env.MAX_DAILY_API_COST) || 100.00,
      alertThreshold: parseFloat(process.env.ALERT_THRESHOLD) || 80.00
    };
  }

  /**
   * Get usage statistics for a specific period
   */
  async getUsageStats(startDate, endDate, groupBy = 'day') {
    try {
      const whereClause = {
        created_at: {
          [Op.between]: [startDate, endDate]
        },
        status_code: {
          [Op.between]: [200, 299]
        }
      };

      // Get aggregated usage data
      const usageData = await ApiUsage.findAll({
        where: whereClause,
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'request_count'],
          [sequelize.fn('SUM', sequelize.col('total_tokens')), 'total_tokens'],
          [sequelize.fn('SUM', sequelize.col('cost_usd')), 'total_cost'],
          [sequelize.fn('AVG', sequelize.col('response_time_ms')), 'avg_response_time'],
          'llm_provider'
        ],
        group: ['date', 'llm_provider'],
        order: [['date', 'ASC']]
      });

      // Get user statistics
      const userStats = await this.getUserStats(startDate, endDate);
      
      // Get provider distribution
      const providerStats = await this.getProviderStats(startDate, endDate);

      return {
        usage: usageData,
        users: userStats,
        providers: providerStats,
        period: { start: startDate, end: endDate }
      };
    } catch (error) {
      logger.error('Error getting usage statistics:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(startDate, endDate) {
    try {
      const totalUsers = await User.count();
      const activeUsers = await User.count({
        where: {
          last_login: {
            [Op.between]: [startDate, endDate]
          }
        }
      });

      const subscriptionStats = await User.findAll({
        attributes: [
          'subscription_status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['subscription_status']
      });

      const newUsers = await User.count({
        where: {
          created_at: {
            [Op.between]: [startDate, endDate]
          }
        }
      });

      return {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
        subscriptions: subscriptionStats.reduce((acc, stat) => {
          acc[stat.subscription_status] = parseInt(stat.get('count'));
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw error;
    }
  }

  /**
   * Get provider usage statistics
   */
  async getProviderStats(startDate, endDate) {
    try {
      const providerStats = await ApiUsage.findAll({
        where: {
          created_at: {
            [Op.between]: [startDate, endDate]
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        },
        attributes: [
          'llm_provider',
          'model_used',
          [sequelize.fn('COUNT', sequelize.col('id')), 'request_count'],
          [sequelize.fn('SUM', sequelize.col('total_tokens')), 'total_tokens'],
          [sequelize.fn('SUM', sequelize.col('cost_usd')), 'total_cost'],
          [sequelize.fn('AVG', sequelize.col('response_time_ms')), 'avg_response_time']
        ],
        group: ['llm_provider', 'model_used'],
        order: [['total_cost', 'DESC']]
      });

      return providerStats.map(stat => ({
        provider: stat.llm_provider,
        model: stat.model_used,
        requests: parseInt(stat.get('request_count')),
        tokens: parseInt(stat.get('total_tokens')) || 0,
        cost: parseFloat(stat.get('total_cost')) || 0,
        avgResponseTime: parseFloat(stat.get('avg_response_time')) || 0
      }));
    } catch (error) {
      logger.error('Error getting provider statistics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      // Today's metrics
      const todayMetrics = await ApiUsage.findOne({
        where: {
          created_at: {
            [Op.gte]: today
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'requests'],
          [sequelize.fn('SUM', sequelize.col('cost_usd')), 'cost'],
          [sequelize.fn('AVG', sequelize.col('response_time_ms')), 'avg_response_time']
        ]
      });

      // This hour's metrics
      const hourlyMetrics = await ApiUsage.findOne({
        where: {
          created_at: {
            [Op.gte]: thisHour
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'requests'],
          [sequelize.fn('SUM', sequelize.col('cost_usd')), 'cost']
        ]
      });

      // Active API keys
      const activeKeys = await ApiKey.count({
        where: { is_active: true }
      });

      // Error rate (last hour)
      const totalRequests = await ApiUsage.count({
        where: {
          created_at: {
            [Op.gte]: thisHour
          }
        }
      });

      const errorRequests = await ApiUsage.count({
        where: {
          created_at: {
            [Op.gte]: thisHour
          },
          status_code: {
            [Op.gte]: 400
          }
        }
      });

      const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

      return {
        today: {
          requests: parseInt(todayMetrics?.get('requests')) || 0,
          cost: parseFloat(todayMetrics?.get('cost')) || 0,
          avgResponseTime: parseFloat(todayMetrics?.get('avg_response_time')) || 0
        },
        hourly: {
          requests: parseInt(hourlyMetrics?.get('requests')) || 0,
          cost: parseFloat(hourlyMetrics?.get('cost')) || 0
        },
        system: {
          activeApiKeys: activeKeys,
          errorRate: parseFloat(errorRate.toFixed(2)),
          timestamp: now
        }
      };
    } catch (error) {
      logger.error('Error getting real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Get cost analysis and alerts
   */
  async getCostAnalysis() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Daily cost
      const dailyCost = await ApiUsage.sum('cost_usd', {
        where: {
          created_at: {
            [Op.gte]: startOfDay
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        }
      }) || 0;

      // Monthly cost
      const monthlyCost = await ApiUsage.sum('cost_usd', {
        where: {
          created_at: {
            [Op.gte]: startOfMonth
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        }
      }) || 0;

      // Cost by provider (today)
      const providerCosts = await ApiUsage.findAll({
        where: {
          created_at: {
            [Op.gte]: startOfDay
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        },
        attributes: [
          'llm_provider',
          [sequelize.fn('SUM', sequelize.col('cost_usd')), 'cost']
        ],
        group: ['llm_provider']
      });

      // Check alerts
      const alerts = [];
      
      if (dailyCost > this.costThresholds.alertThreshold) {
        alerts.push({
          type: 'cost_warning',
          message: `Daily cost (${dailyCost.toFixed(2)}) approaching limit (${this.costThresholds.daily})`,
          severity: 'warning'
        });
      }

      if (dailyCost > this.costThresholds.daily) {
        alerts.push({
          type: 'cost_exceeded',
          message: `Daily cost limit exceeded: $${dailyCost.toFixed(2)}`,
          severity: 'critical'
        });
      }

      return {
        costs: {
          daily: parseFloat(dailyCost.toFixed(6)),
          monthly: parseFloat(monthlyCost.toFixed(6)),
          dailyLimit: this.costThresholds.daily,
          dailyUtilization: (dailyCost / this.costThresholds.daily) * 100
        },
        byProvider: providerCosts.map(item => ({
          provider: item.llm_provider,
          cost: parseFloat(item.get('cost')) || 0
        })),
        alerts
      };
    } catch (error) {
      logger.error('Error getting cost analysis:', error);
      throw error;
    }
  }

  /**
   * Get top users by usage
   */
  async getTopUsers(limit = 10, period = 'month') {
    try {
      const startDate = this.getPeriodStartDate(period);
      
      const topUsers = await ApiUsage.findAll({
        where: {
          created_at: {
            [Op.gte]: startDate
          },
          user_id: {
            [Op.ne]: null
          },
          status_code: {
            [Op.between]: [200, 299]
          }
        },
        attributes: [
          'user_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'request_count'],
          [sequelize.fn('SUM', sequelize.col('cost_usd')), 'total_cost'],
          [sequelize.fn('SUM', sequelize.col('total_tokens')), 'total_tokens']
        ],
        include: [{
          model: User,
          as: 'user',
          attributes: ['email', 'subscription_status']
        }],
        group: ['user_id'],
        order: [[sequelize.fn('SUM', sequelize.col('cost_usd')), 'DESC']],
        limit
      });

      return topUsers.map(usage => ({
        userId: usage.user_id,
        email: usage.user?.email || 'Unknown',
        subscriptionStatus: usage.user?.subscription_status || 'free',
        requests: parseInt(usage.get('request_count')),
        cost: parseFloat(usage.get('total_cost')) || 0,
        tokens: parseInt(usage.get('total_tokens')) || 0
      }));
    } catch (error) {
      logger.error('Error getting top users:', error);
      throw error;
    }
  }

  /**
   * Get rate limiting statistics
   */
  async getRateLimitStats(period = 'day') {
    try {
      const startDate = this.getPeriodStartDate(period);

      const rateLimitData = await RateLimit.findAll({
        where: {
          created_at: {
            [Op.gte]: startDate
          },
          is_blocked: true
        },
        attributes: [
          'identifier_type',
          'endpoint',
          [sequelize.fn('COUNT', sequelize.col('id')), 'block_count'],
          [sequelize.fn('AVG', sequelize.col('requests_count')), 'avg_requests']
        ],
        group: ['identifier_type', 'endpoint'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
      });

      return rateLimitData.map(item => ({
        identifierType: item.identifier_type,
        endpoint: item.endpoint,
        blockCount: parseInt(item.get('block_count')),
        avgRequests: parseFloat(item.get('avg_requests')) || 0
      }));
    } catch (error) {
      logger.error('Error getting rate limit statistics:', error);
      throw error;
    }
  }

  /**
   * Generate daily report
   */
  async generateDailyReport() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const endOfYesterday = new Date(startOfYesterday);
      endOfYesterday.setDate(endOfYesterday.getDate() + 1);

      const stats = await this.getUsageStats(startOfYesterday, endOfYesterday);
      const costAnalysis = await this.getCostAnalysis();
      const topUsers = await this.getTopUsers(5, 'day');
      const rateLimitStats = await this.getRateLimitStats('day');

      const report = {
        date: yesterday.toISOString().split('T')[0],
        summary: {
          totalRequests: stats.usage.reduce((sum, item) => sum + parseInt(item.get('request_count')), 0),
          totalCost: stats.usage.reduce((sum, item) => sum + parseFloat(item.get('total_cost')), 0),
          averageResponseTime: stats.usage.reduce((sum, item) => sum + parseFloat(item.get('avg_response_time')), 0) / stats.usage.length || 0,
          activeUsers: stats.users.active,
          newUsers: stats.users.new
        },
        providers: stats.providers,
        topUsers,
        rateLimiting: rateLimitStats,
        costs: costAnalysis.costs,
        alerts: costAnalysis.alerts
      };

      logger.info('Daily report generated:', report);
      return report;
    } catch (error) {
      logger.error('Error generating daily report:', error);
      throw error;
    }
  }

  /**
   * Helper method to get period start date
   */
  getPeriodStartDate(period) {
    const now = new Date();
    switch (period) {
      case 'hour':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }
}

module.exports = new AnalyticsService();