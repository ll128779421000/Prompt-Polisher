const Redis = require('redis');
const User = require('../models/User');
const Usage = require('../models/Usage');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

class MonitoringService {
  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.redis.connect().catch(error => {
      logger.error('Redis connection failed:', error);
    });

    // Email transporter for alerts
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Alert thresholds
    this.thresholds = {
      costAlert: parseFloat(process.env.COST_ALERT_THRESHOLD || 1000),
      usageAlert: parseInt(process.env.USAGE_ALERT_THRESHOLD || 10000),
      rateLimitThreshold: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
      responseTimeThreshold: 5000, // 5 seconds
      errorRateThreshold: 0.1 // 10%
    };
  }

  // Real-time usage tracking
  async trackUsage(userId, apiKey, endpoint, requestData, responseData) {
    try {
      const usageRecord = new Usage({
        user: userId,
        apiKey,
        endpoint,
        method: requestData.method,
        requestBody: requestData.body,
        responseStatus: responseData.status,
        responseTime: responseData.responseTime,
        cost: this.calculateCost(requestData, responseData),
        metadata: {
          userAgent: requestData.userAgent,
          ipAddress: requestData.ip,
          tokens: responseData.tokens,
          model: responseData.model,
          provider: responseData.provider
        }
      });

      await usageRecord.save();

      // Update real-time statistics in Redis
      await this.updateRealTimeStats(userId, usageRecord);

      // Check for anomalies
      await this.checkForAnomalies(userId, usageRecord);

      // Update user usage counters
      await this.updateUserUsage(userId, usageRecord);

      return usageRecord;
    } catch (error) {
      logger.error('Error tracking usage:', error);
      throw error;
    }
  }

  // Calculate cost based on usage
  calculateCost(requestData, responseData) {
    const basePrice = parseFloat(process.env.PRICE_PER_QUERY || 0.01);
    let cost = basePrice;

    // Adjust cost based on tokens if available
    if (responseData.tokens) {
      const tokenCost = (responseData.tokens.total || 0) * 0.0001; // $0.0001 per token
      cost = Math.max(cost, tokenCost);
    }

    // Adjust cost based on response time (penalty for slow requests)
    if (responseData.responseTime > 10000) { // 10 seconds
      cost *= 1.5;
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  // Update real-time statistics in Redis
  async updateRealTimeStats(userId, usage) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      
      const pipeline = this.redis.multi();
      
      // Global stats
      pipeline.incr('stats:global:requests:total');
      pipeline.incr(`stats:global:requests:${today}`);
      pipeline.incr(`stats:global:requests:${today}:${hour}`);
      pipeline.incrByFloat('stats:global:revenue:total', usage.cost);
      pipeline.incrByFloat(`stats:global:revenue:${today}`, usage.cost);
      
      // User-specific stats
      pipeline.incr(`stats:user:${userId}:requests:total`);
      pipeline.incr(`stats:user:${userId}:requests:${today}`);
      pipeline.incrByFloat(`stats:user:${userId}:cost:total`, usage.cost);
      pipeline.incrByFloat(`stats:user:${userId}:cost:${today}`, usage.cost);
      
      // Endpoint stats
      const endpointKey = usage.endpoint.replace(/[/:]/g, '_');
      pipeline.incr(`stats:endpoint:${endpointKey}:requests`);
      pipeline.incrByFloat(`stats:endpoint:${endpointKey}:cost`, usage.cost);
      
      // Response time tracking
      pipeline.lpush(`stats:response_times:${today}`, usage.responseTime);
      pipeline.ltrim(`stats:response_times:${today}`, 0, 999); // Keep last 1000
      
      // Error tracking
      if (usage.responseStatus >= 400) {
        pipeline.incr(`stats:errors:${today}`);
        pipeline.incr(`stats:errors:${usage.responseStatus}:${today}`);
      }
      
      await pipeline.exec();
    } catch (error) {
      logger.error('Error updating real-time stats:', error);
    }
  }

  // Check for usage anomalies
  async checkForAnomalies(userId, usage) {
    try {
      const anomalies = await Usage.detectAnomalies(userId);
      
      if (anomalies.isAnomalous.hourly || anomalies.isAnomalous.daily) {
        await this.flagSuspiciousActivity(userId, {
          type: 'unusual_usage',
          description: `Unusual usage detected: ${anomalies.hourlyUsage} requests in the last hour, ${anomalies.dailyUsage} requests today (baseline: ${Math.round(anomalies.baselineDaily)})`,
          severity: anomalies.isAnomalous.daily ? 'high' : 'medium'
        });
      }
    } catch (error) {
      logger.error('Error checking anomalies:', error);
    }
  }

  // Update user usage counters
  async updateUserUsage(userId, usage) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Check if we need to reset monthly counters
      const now = new Date();
      const lastReset = new Date(user.usage.lastResetDate);
      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        user.usage.currentMonthQueries = 0;
        user.usage.lastResetDate = now;
      }

      // Update counters
      user.usage.totalQueries += 1;
      user.usage.currentMonthQueries += 1;
      user.billing.totalSpent += usage.cost;

      // Decrease remaining queries for non-subscription users
      if (user.subscription.type === 'free' && user.usage.remainingQueries > 0) {
        user.usage.remainingQueries -= 1;
      }

      await user.save();

      // Check usage limits and send alerts
      await this.checkUsageLimits(user);
    } catch (error) {
      logger.error('Error updating user usage:', error);
    }
  }

  // Check usage limits and send alerts
  async checkUsageLimits(user) {
    try {
      const alerts = [];

      // Check cost alerts
      if (user.billing.totalSpent >= this.thresholds.costAlert) {
        alerts.push({
          type: 'cost',
          message: `Total spending has exceeded $${this.thresholds.costAlert}`,
          severity: 'high'
        });
      }

      // Check usage alerts for free tier users
      if (user.subscription.type === 'free' && user.usage.remainingQueries <= 10) {
        alerts.push({
          type: 'usage',
          message: `Only ${user.usage.remainingQueries} queries remaining`,
          severity: user.usage.remainingQueries === 0 ? 'high' : 'medium'
        });
      }

      // Send alerts
      for (const alert of alerts) {
        await this.sendAlert(user, alert);
      }
    } catch (error) {
      logger.error('Error checking usage limits:', error);
    }
  }

  // Flag suspicious activity
  async flagSuspiciousActivity(userId, activity) {
    try {
      await User.findByIdAndUpdate(userId, {
        $push: {
          'security.suspiciousActivity': activity
        }
      });

      // Send alert to admins
      await this.sendAdminAlert('security', {
        userId,
        activity,
        timestamp: new Date()
      });

      logger.warn(`Suspicious activity flagged for user ${userId}:`, activity);
    } catch (error) {
      logger.error('Error flagging suspicious activity:', error);
    }
  }

  // Get real-time dashboard data
  async getDashboardData(timeRange = '24h') {
    try {
      const now = new Date();
      let startDate, endDate = now;

      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const [
        usageStats,
        revenueStats,
        topEndpoints,
        activeUsers,
        systemHealth
      ] = await Promise.all([
        Usage.getUsageStats(null, startDate, endDate),
        Payment.getRevenueStats(startDate, endDate),
        Usage.getTopEndpoints(10, startDate, endDate),
        this.getActiveUsers(startDate, endDate),
        this.getSystemHealth()
      ]);

      return {
        timeRange,
        period: { startDate, endDate },
        usage: usageStats,
        revenue: revenueStats,
        topEndpoints,
        activeUsers,
        systemHealth,
        realTimeMetrics: await this.getRealTimeMetrics()
      };
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  // Get active users
  async getActiveUsers(startDate, endDate) {
    try {
      const activeUsers = await Usage.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$user',
            requestCount: { $sum: 1 },
            totalCost: { $sum: '$cost' },
            lastActivity: { $max: '$timestamp' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $project: {
            userId: '$_id',
            email: '$user.email',
            name: '$user.name',
            subscription: '$user.subscription.type',
            requestCount: 1,
            totalCost: 1,
            lastActivity: 1
          }
        },
        {
          $sort: { requestCount: -1 }
        },
        {
          $limit: 50
        }
      ]);

      return activeUsers;
    } catch (error) {
      logger.error('Error getting active users:', error);
      return [];
    }
  }

  // Get system health metrics
  async getSystemHealth() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [
        totalRequests,
        totalErrors,
        responseTimes
      ] = await Promise.all([
        this.redis.get(`stats:global:requests:${today}`) || '0',
        this.redis.get(`stats:errors:${today}`) || '0',
        this.redis.lRange(`stats:response_times:${today}`, 0, -1)
      ]);

      const requestCount = parseInt(totalRequests);
      const errorCount = parseInt(totalErrors);
      const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
      
      const responseTimeArray = responseTimes.map(t => parseFloat(t)).filter(t => !isNaN(t));
      const avgResponseTime = responseTimeArray.length > 0 
        ? responseTimeArray.reduce((a, b) => a + b, 0) / responseTimeArray.length 
        : 0;

      return {
        status: this.getOverallStatus(errorRate, avgResponseTime),
        metrics: {
          requestCount,
          errorCount,
          errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
          avgResponseTime: Math.round(avgResponseTime),
          uptime: process.uptime()
        },
        alerts: await this.getActiveAlerts()
      };
    } catch (error) {
      logger.error('Error getting system health:', error);
      return {
        status: 'unknown',
        metrics: {},
        alerts: []
      };
    }
  }

  // Get overall system status
  getOverallStatus(errorRate, avgResponseTime) {
    if (errorRate > this.thresholds.errorRateThreshold || avgResponseTime > this.thresholds.responseTimeThreshold) {
      return 'degraded';
    }
    if (errorRate > this.thresholds.errorRateThreshold * 0.5 || avgResponseTime > this.thresholds.responseTimeThreshold * 0.7) {
      return 'warning';
    }
    return 'healthy';
  }

  // Get real-time metrics
  async getRealTimeMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      
      const [
        currentHourRequests,
        todayRequests,
        totalRequests,
        todayRevenue,
        totalRevenue
      ] = await Promise.all([
        this.redis.get(`stats:global:requests:${today}:${hour}`) || '0',
        this.redis.get(`stats:global:requests:${today}`) || '0',
        this.redis.get('stats:global:requests:total') || '0',
        this.redis.get(`stats:global:revenue:${today}`) || '0',
        this.redis.get('stats:global:revenue:total') || '0'
      ]);

      return {
        currentHourRequests: parseInt(currentHourRequests),
        todayRequests: parseInt(todayRequests),
        totalRequests: parseInt(totalRequests),
        todayRevenue: parseFloat(todayRevenue) || 0,
        totalRevenue: parseFloat(totalRevenue) || 0
      };
    } catch (error) {
      logger.error('Error getting real-time metrics:', error);
      return {};
    }
  }

  // Send user alert
  async sendAlert(user, alert) {
    try {
      if (!user.preferences.emailNotifications) return;

      const emailOptions = {
        from: process.env.SMTP_USER,
        to: user.email,
        subject: `Alert: ${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} Threshold Reached`,
        html: `
          <h2>Usage Alert</h2>
          <p>Dear ${user.name},</p>
          <p><strong>${alert.message}</strong></p>
          <p>Severity: ${alert.severity}</p>
          <p>Please review your usage and consider upgrading your plan if needed.</p>
          <br>
          <p>Best regards,<br>Your API Team</p>
        `
      };

      await this.emailTransporter.sendMail(emailOptions);
      logger.info(`Alert sent to user ${user._id}: ${alert.type}`);
    } catch (error) {
      logger.error('Error sending user alert:', error);
    }
  }

  // Send admin alert
  async sendAdminAlert(type, data) {
    try {
      const emailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.ALERT_EMAIL,
        subject: `Admin Alert: ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        html: `
          <h2>Admin Alert</h2>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Data:</strong></p>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        `
      };

      await this.emailTransporter.sendMail(emailOptions);
      logger.info(`Admin alert sent: ${type}`);
    } catch (error) {
      logger.error('Error sending admin alert:', error);
    }
  }

  // Get active alerts
  async getActiveAlerts() {
    try {
      // Get recent suspicious activities
      const recentActivities = await User.aggregate([
        {
          $match: {
            'security.suspiciousActivity.timestamp': {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        },
        {
          $unwind: '$security.suspiciousActivity'
        },
        {
          $match: {
            'security.suspiciousActivity.timestamp': {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $sort: { 'security.suspiciousActivity.timestamp': -1 }
        },
        {
          $limit: 10
        }
      ]);

      return recentActivities.map(activity => ({
        type: 'security',
        severity: activity.security.suspiciousActivity.severity,
        message: activity.security.suspiciousActivity.description,
        timestamp: activity.security.suspiciousActivity.timestamp,
        userId: activity._id
      }));
    } catch (error) {
      logger.error('Error getting active alerts:', error);
      return [];
    }
  }
}

module.exports = new MonitoringService();