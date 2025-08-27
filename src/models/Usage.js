const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  apiKey: String,
  endpoint: String,
  method: String,
  requestBody: {
    type: mongoose.Schema.Types.Mixed
  },
  responseStatus: Number,
  responseTime: Number, // in milliseconds
  cost: {
    type: Number,
    default: 0
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    country: String,
    region: String,
    tokens: {
      input: Number,
      output: Number,
      total: Number
    },
    model: String,
    provider: String
  },
  billing: {
    charged: {
      type: Boolean,
      default: false
    },
    chargedAt: Date,
    billingCycle: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
usageSchema.index({ user: 1, timestamp: -1 });
usageSchema.index({ timestamp: -1 });
usageSchema.index({ apiKey: 1, timestamp: -1 });
usageSchema.index({ 'metadata.ipAddress': 1 });
usageSchema.index({ endpoint: 1 });

// Static method to get usage statistics
usageSchema.statics.getUsageStats = async function(userId, startDate, endDate) {
  const match = {
    timestamp: {
      $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      $lte: endDate || new Date()
    }
  };
  
  if (userId) {
    match.user = new mongoose.Types.ObjectId(userId);
  }
  
  const pipeline = [
    { $match: match },
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
        successfulRequests: {
          $sum: {
            $cond: [{ $gte: ['$responseStatus', 200] }, 1, 0]
          }
        },
        errorRequests: {
          $sum: {
            $cond: [{ $gte: ['$responseStatus', 400] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to detect unusual usage patterns
usageSchema.statics.detectAnomalies = async function(userId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const hourlyUsage = await this.countDocuments({
    user: userId,
    timestamp: { $gte: oneHourAgo }
  });
  
  const dailyUsage = await this.countDocuments({
    user: userId,
    timestamp: { $gte: oneDayAgo }
  });
  
  // Get user's average usage
  const avgDailyUsage = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        },
        dailyCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgDaily: { $avg: '$dailyCount' }
      }
    }
  ]);
  
  const baselineDaily = avgDailyUsage.length > 0 ? avgDailyUsage[0].avgDaily : 0;
  
  return {
    hourlyUsage,
    dailyUsage,
    baselineDaily,
    isAnomalous: {
      hourly: hourlyUsage > 1000, // More than 1000 requests per hour
      daily: dailyUsage > baselineDaily * 5 // 5x the normal usage
    }
  };
};

// Static method to get top endpoints
usageSchema.statics.getTopEndpoints = function(limit = 10, startDate, endDate) {
  const match = {
    timestamp: {
      $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      $lte: endDate || new Date()
    }
  };
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$endpoint',
        totalRequests: { $sum: 1 },
        totalCost: { $sum: '$cost' },
        avgResponseTime: { $avg: '$responseTime' },
        errorRate: {
          $avg: {
            $cond: [{ $gte: ['$responseStatus', 400] }, 1, 0]
          }
        }
      }
    },
    { $sort: { totalRequests: -1 } },
    { $limit: limit }
  ]);
};

module.exports = mongoose.model('Usage', usageSchema);