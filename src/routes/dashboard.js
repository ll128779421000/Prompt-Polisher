const express = require('express');
const monitoringService = require('../services/monitoring');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Usage = require('../models/Usage');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

// Get dashboard overview (admin only)
router.get('/overview', auth, admin, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    const dashboardData = await monitoringService.getDashboardData(timeRange);
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get real-time metrics
router.get('/metrics/realtime', auth, admin, async (req, res) => {
  try {
    const metrics = await monitoringService.getRealTimeMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user analytics
router.get('/analytics/users', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const analytics = await monitoringService.getActiveUsers(start, end);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const revenue = await Payment.getRevenueStats(start, end);
    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get usage analytics
router.get('/analytics/usage', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const usage = await Usage.getUsageStats(userId, start, end);
    res.json(usage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top endpoints
router.get('/analytics/endpoints', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const endpoints = await Usage.getTopEndpoints(parseInt(limit), start, end);
    res.json(endpoints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system health
router.get('/health', auth, admin, async (req, res) => {
  try {
    const health = await monitoringService.getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user dashboard (for individual users)
router.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const [usageStats, payments, user] = await Promise.all([
      Usage.getUsageStats(userId, startDate, endDate),
      Payment.find({ user: userId }).sort({ createdAt: -1 }).limit(10),
      User.findById(userId).select('-password')
    ]);
    
    res.json({
      user: {
        subscription: user.subscription,
        usage: user.usage,
        billing: user.billing
      },
      usageStats,
      recentPayments: payments,
      period: { startDate, endDate }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts
router.get('/alerts', auth, admin, async (req, res) => {
  try {
    const { severity, limit = 50 } = req.query;
    
    const match = {};
    if (severity) {
      match['security.suspiciousActivity.severity'] = severity;
    }
    
    const alerts = await User.aggregate([
      { $match: match },
      { $unwind: '$security.suspiciousActivity' },
      {
        $match: {
          'security.suspiciousActivity.timestamp': {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      },
      {
        $project: {
          userId: '$_id',
          email: 1,
          name: 1,
          alert: '$security.suspiciousActivity'
        }
      },
      { $sort: { 'alert.timestamp': -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get failed payments
router.get('/payments/failed', auth, admin, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const failedPayments = await Payment.getFailedPayments(parseInt(limit));
    res.json(failedPayments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export usage data
router.get('/export/usage', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const usage = await Usage.find({
      timestamp: { $gte: start, $lte: end }
    })
    .populate('user', 'email name')
    .sort({ timestamp: -1 });
    
    if (format === 'csv') {
      const csv = await convertToCSV(usage);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=usage-export.csv');
      res.send(csv);
    } else {
      res.json(usage);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to convert usage data to CSV
async function convertToCSV(usage) {
  const headers = [
    'Date',
    'User Email',
    'User Name',
    'Endpoint',
    'Method',
    'Response Status',
    'Response Time (ms)',
    'Cost',
    'IP Address',
    'Tokens Used'
  ];
  
  const rows = usage.map(u => [
    u.timestamp.toISOString(),
    u.user?.email || 'Unknown',
    u.user?.name || 'Unknown',
    u.endpoint,
    u.method,
    u.responseStatus,
    u.responseTime,
    u.cost,
    u.metadata?.ipAddress || 'Unknown',
    u.metadata?.tokens?.total || 0
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

module.exports = router;