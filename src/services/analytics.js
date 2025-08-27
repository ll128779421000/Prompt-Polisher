const User = require('../models/User');
const Usage = require('../models/Usage');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');

class AnalyticsService {
  // Get user retention metrics
  async getUserRetentionMetrics(startDate, endDate) {
    try {
      const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      const end = endDate || new Date();

      // Get cohort analysis
      const cohorts = await this.getCohortAnalysis(start, end);
      
      // Get churn rate
      const churnRate = await this.getChurnRate(start, end);
      
      // Get user lifecycle metrics
      const lifecycle = await this.getUserLifecycleMetrics(start, end);
      
      // Get engagement metrics
      const engagement = await this.getEngagementMetrics(start, end);

      return {
        cohorts,
        churnRate,
        lifecycle,
        engagement,
        period: { startDate: start, endDate: end }
      };
    } catch (error) {
      logger.error('Error getting user retention metrics:', error);
      throw error;
    }
  }

  // Get cohort analysis
  async getCohortAnalysis(startDate, endDate) {
    try {
      const cohorts = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            newUsers: { $sum: 1 },
            users: { $push: '$_id' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Calculate retention for each cohort
      for (const cohort of cohorts) {
        const cohortDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
        const retentionPeriods = [];

        // Calculate retention for 12 months
        for (let month = 1; month <= 12; month++) {
          const periodStart = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + month, 1);
          const periodEnd = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + month + 1, 0);

          const activeUsers = await Usage.distinct('user', {
            user: { $in: cohort.users },
            timestamp: { $gte: periodStart, $lte: periodEnd }
          });

          retentionPeriods.push({
            month,
            activeUsers: activeUsers.length,
            retentionRate: cohort.newUsers > 0 ? (activeUsers.length / cohort.newUsers) * 100 : 0
          });
        }

        cohort.retention = retentionPeriods;
      }

      return cohorts;
    } catch (error) {
      logger.error('Error getting cohort analysis:', error);
      throw error;
    }
  }

  // Calculate churn rate
  async getChurnRate(startDate, endDate) {
    try {
      const totalUsers = await User.countDocuments({
        createdAt: { $lt: startDate }
      });

      // Users who were active before the period but not during
      const previouslyActiveUsers = await Usage.distinct('user', {
        timestamp: {
          $gte: new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          $lt: startDate
        }
      });

      const currentlyActiveUsers = await Usage.distinct('user', {
        user: { $in: previouslyActiveUsers },
        timestamp: { $gte: startDate, $lte: endDate }
      });

      const churnedUsers = previouslyActiveUsers.length - currentlyActiveUsers.length;
      const churnRate = previouslyActiveUsers.length > 0 
        ? (churnedUsers / previouslyActiveUsers.length) * 100 
        : 0;

      return {
        totalUsers,
        previouslyActive: previouslyActiveUsers.length,
        currentlyActive: currentlyActiveUsers.length,
        churned: churnedUsers,
        churnRate: Math.round(churnRate * 100) / 100
      };
    } catch (error) {
      logger.error('Error calculating churn rate:', error);
      throw error;
    }
  }

  // Get user lifecycle metrics
  async getUserLifecycleMetrics(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'usages',
            localField: '_id',
            foreignField: 'user',
            as: 'usage'
          }
        },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'user',
            as: 'payments'
          }
        },
        {
          $addFields: {
            totalUsage: { $size: '$usage' },
            totalPayments: { $size: '$payments' },
            lastActivity: { $max: '$usage.timestamp' },
            totalSpent: { $sum: '$payments.amount' },
            daysActive: {
              $cond: {
                if: { $gt: ['$usage', []] },
                then: {
                  $divide: [
                    { $subtract: [{ $max: '$usage.timestamp' }, { $min: '$usage.timestamp' }] },
                    1000 * 60 * 60 * 24
                  ]
                },
                else: 0
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            averageUsage: { $avg: '$totalUsage' },
            averagePayments: { $avg: '$totalPayments' },
            averageSpent: { $avg: { $divide: ['$totalSpent', 100] } }, // Convert from cents
            averageDaysActive: { $avg: '$daysActive' },
            newUsers: { $sum: 1 },
            payingUsers: { $sum: { $cond: [{ $gt: ['$totalPayments', 0] }, 1, 0] } },
            activeUsers: { $sum: { $cond: [{ $gt: ['$totalUsage', 0] }, 1, 0] } }
          }
        }
      ];

      const result = await User.aggregate(pipeline);
      const metrics = result[0] || {};

      return {
        totalUsers: metrics.totalUsers || 0,
        activeUsers: metrics.activeUsers || 0,
        payingUsers: metrics.payingUsers || 0,
        conversionRate: metrics.totalUsers > 0 ? (metrics.payingUsers / metrics.totalUsers) * 100 : 0,
        averageUsage: Math.round(metrics.averageUsage || 0),
        averageSpent: Math.round((metrics.averageSpent || 0) * 100) / 100,
        averageDaysActive: Math.round((metrics.averageDaysActive || 0) * 100) / 100
      };
    } catch (error) {
      logger.error('Error getting user lifecycle metrics:', error);
      throw error;
    }
  }

  // Get user engagement metrics
  async getEngagementMetrics(startDate, endDate) {
    try {
      const dailyActiveUsers = await this.getDailyActiveUsers(startDate, endDate);
      const weeklyActiveUsers = await this.getWeeklyActiveUsers(startDate, endDate);
      const monthlyActiveUsers = await this.getMonthlyActiveUsers(startDate, endDate);

      // Calculate engagement scores
      const engagementByUser = await Usage.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$user',
            totalSessions: { $sum: 1 },
            uniqueDays: {
              $addToSet: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
              }
            },
            avgResponseTime: { $avg: '$responseTime' },
            totalCost: { $sum: '$cost' }
          }
        },
        {
          $addFields: {
            daysActive: { $size: '$uniqueDays' },
            sessionsPerDay: { $divide: ['$totalSessions', { $size: '$uniqueDays' }] }
          }
        },
        {
          $group: {
            _id: null,
            totalEngagedUsers: { $sum: 1 },
            avgSessionsPerUser: { $avg: '$totalSessions' },
            avgDaysActivePerUser: { $avg: '$daysActive' },
            avgSessionsPerDay: { $avg: '$sessionsPerDay' },
            avgResponseTime: { $avg: '$avgResponseTime' },
            totalRevenue: { $sum: '$totalCost' }
          }
        }
      ]);

      const engagement = engagementByUser[0] || {};

      return {
        dailyActiveUsers: dailyActiveUsers.length,
        weeklyActiveUsers: weeklyActiveUsers.length,
        monthlyActiveUsers: monthlyActiveUsers.length,
        avgSessionsPerUser: Math.round(engagement.avgSessionsPerUser || 0),
        avgDaysActivePerUser: Math.round((engagement.avgDaysActivePerUser || 0) * 100) / 100,
        avgSessionsPerDay: Math.round((engagement.avgSessionsPerDay || 0) * 100) / 100,
        avgResponseTime: Math.round(engagement.avgResponseTime || 0),
        totalRevenue: Math.round((engagement.totalRevenue || 0) * 100) / 100
      };
    } catch (error) {
      logger.error('Error getting engagement metrics:', error);
      throw error;
    }
  }

  // Get daily active users
  async getDailyActiveUsers(startDate, endDate) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      return await Usage.distinct('user', {
        timestamp: { $gte: yesterday, $lte: today }
      });
    } catch (error) {
      logger.error('Error getting daily active users:', error);
      return [];
    }
  }

  // Get weekly active users
  async getWeeklyActiveUsers(startDate, endDate) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      return await Usage.distinct('user', {
        timestamp: { $gte: weekAgo }
      });
    } catch (error) {
      logger.error('Error getting weekly active users:', error);
      return [];
    }
  }

  // Get monthly active users
  async getMonthlyActiveUsers(startDate, endDate) {
    try {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      return await Usage.distinct('user', {
        timestamp: { $gte: monthAgo }
      });
    } catch (error) {
      logger.error('Error getting monthly active users:', error);
      return [];
    }
  }

  // Get user segmentation
  async getUserSegmentation(startDate, endDate) {
    try {
      const segments = await User.aggregate([
        {
          $lookup: {
            from: 'usages',
            localField: '_id',
            foreignField: 'user',
            as: 'usage'
          }
        },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'user',
            as: 'payments'
          }
        },
        {
          $addFields: {
            totalUsage: { $size: '$usage' },
            totalPayments: { $size: '$payments' },
            totalSpent: { $sum: '$payments.amount' },
            recentUsage: {
              $size: {
                $filter: {
                  input: '$usage',
                  cond: {
                    $gte: ['$$this.timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            segment: {
              $switch: {
                branches: [
                  {
                    case: { $and: [{ $gt: ['$totalSpent', 10000] }, { $gt: ['$recentUsage', 100] }] },
                    then: 'power_user'
                  },
                  {
                    case: { $and: [{ $gt: ['$totalSpent', 1000] }, { $gt: ['$recentUsage', 20] }] },
                    then: 'regular_user'
                  },
                  {
                    case: { $gt: ['$totalPayments', 0] },
                    then: 'paying_user'
                  },
                  {
                    case: { $gt: ['$recentUsage', 0] },
                    then: 'active_free'
                  },
                  {
                    case: { $gt: ['$totalUsage', 0] },
                    then: 'inactive'
                  }
                ],
                default: 'new_user'
              }
            }
          }
        },
        {
          $group: {
            _id: '$segment',
            count: { $sum: 1 },
            avgSpent: { $avg: { $divide: ['$totalSpent', 100] } },
            avgUsage: { $avg: '$totalUsage' },
            avgRecentUsage: { $avg: '$recentUsage' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return segments;
    } catch (error) {
      logger.error('Error getting user segmentation:', error);
      throw error;
    }
  }

  // Get funnel analysis
  async getFunnelAnalysis(startDate, endDate) {
    try {
      const totalSignups = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const activatedUsers = await Usage.distinct('user', {
        timestamp: { $gte: startDate, $lte: endDate }
      });

      const payingUsers = await Payment.distinct('user', {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'succeeded'
      });

      const subscribedUsers = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        'subscription.type': { $in: ['monthly', 'yearly'] }
      });

      return {
        signups: totalSignups,
        activated: activatedUsers.length,
        firstPurchase: payingUsers.length,
        subscribed: subscribedUsers,
        conversionRates: {
          signupToActivation: totalSignups > 0 ? (activatedUsers.length / totalSignups) * 100 : 0,
          activationToPurchase: activatedUsers.length > 0 ? (payingUsers.length / activatedUsers.length) * 100 : 0,
          purchaseToSubscription: payingUsers.length > 0 ? (subscribedUsers / payingUsers.length) * 100 : 0
        }
      };
    } catch (error) {
      logger.error('Error getting funnel analysis:', error);
      throw error;
    }
  }

  // Get revenue cohorts
  async getRevenueCohorts(startDate, endDate) {
    try {
      const cohorts = await Payment.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'succeeded'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $group: {
            _id: {
              year: { $year: '$user.createdAt' },
              month: { $month: '$user.createdAt' }
            },
            users: { $addToSet: '$user._id' },
            totalRevenue: { $sum: '$amount' },
            payments: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Calculate cumulative revenue for each cohort
      for (const cohort of cohorts) {
        const cohortDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
        const revenueByMonth = [];

        for (let month = 0; month < 12; month++) {
          const periodStart = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + month, 1);
          const periodEnd = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + month + 1, 0);

          const monthlyRevenue = await Payment.aggregate([
            {
              $match: {
                user: { $in: cohort.users },
                createdAt: { $gte: periodStart, $lte: periodEnd },
                status: 'succeeded'
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$amount' }
              }
            }
          ]);

          revenueByMonth.push({
            month,
            revenue: monthlyRevenue[0]?.revenue || 0,
            revenuePerUser: cohort.users.length > 0 ? (monthlyRevenue[0]?.revenue || 0) / cohort.users.length : 0
          });
        }

        cohort.revenueByMonth = revenueByMonth;
      }

      return cohorts;
    } catch (error) {
      logger.error('Error getting revenue cohorts:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();