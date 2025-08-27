const express = require('express');
const stripeService = require('../services/stripe');
const Payment = require('../models/Payment');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Create subscription
router.post('/subscription', 
  auth,
  [
    body('priceType').isIn(['monthly', 'yearly']).withMessage('Invalid subscription type'),
    body('paymentMethodId').notEmpty().withMessage('Payment method ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { priceType, paymentMethodId } = req.body;
      const subscription = await stripeService.createSubscription(req.user._id, priceType, paymentMethodId);

      res.json({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        status: subscription.status
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Create query pack payment
router.post('/query-pack',
  auth,
  [
    body('packSize').isIn([100, 500, 1000]).withMessage('Invalid pack size')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { packSize } = req.body;
      const paymentIntent = await stripeService.createQueryPackPayment(req.user._id, packSize);

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Cancel subscription
router.post('/subscription/cancel',
  auth,
  [
    body('immediately').optional().isBoolean().withMessage('Immediately must be a boolean')
  ],
  async (req, res) => {
    try {
      const { immediately = false } = req.body;
      const subscription = await stripeService.cancelSubscription(req.user._id, immediately);

      res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (status) {
      filter.status = status;
    }

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-webhookData');

    const total = await Payment.countDocuments(filter);

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment details
router.get('/:paymentId', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      user: req.user._id
    }).select('-webhookData');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all payments
router.get('/admin/all', auth, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter)
      .populate('user', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-webhookData');

    const total = await Payment.countDocuments(filter);

    // Get summary statistics
    const stats = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      payments,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Process refund
router.post('/admin/:paymentId/refund',
  auth,
  admin,
  [
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, reason = 'requested_by_customer' } = req.body;
      const refund = await stripeService.processRefund(req.params.paymentId, amount, reason);

      res.json({
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Get revenue analytics
router.get('/admin/analytics/revenue', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let groupByFormat;
    switch (groupBy) {
      case 'hour':
        groupByFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        groupByFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'month':
        groupByFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        groupByFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const analytics = await Payment.aggregate([
      {
        $match: {
          status: 'succeeded',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: groupByFormat,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          avgTransactionValue: { $avg: '$amount' },
          subscriptionRevenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'subscription'] }, '$amount', 0]
            }
          },
          oneTimeRevenue: {
            $sum: {
              $cond: [{ $ne: ['$type', 'subscription'] }, '$amount', 0]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
      }
    ]);

    // Get MRR (Monthly Recurring Revenue) for subscriptions
    const mrr = await Payment.aggregate([
      {
        $match: {
          type: 'subscription',
          status: 'succeeded',
          'metadata.subscriptionType': 'monthly',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          monthlyRecurring: { $sum: '$amount' }
        }
      }
    ]);

    // Get ARR (Annual Recurring Revenue)
    const arr = await Payment.aggregate([
      {
        $match: {
          type: 'subscription',
          status: 'succeeded',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          annualRecurring: {
            $sum: {
              $cond: [
                { $eq: ['$metadata.subscriptionType', 'yearly'] },
                '$amount',
                { $multiply: ['$amount', 12] } // Convert monthly to annual
              ]
            }
          }
        }
      }
    ]);

    res.json({
      analytics,
      mrr: mrr[0]?.monthlyRecurring || 0,
      arr: arr[0]?.annualRecurring || 0,
      period: { startDate: start, endDate: end }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get payment method analytics
router.get('/admin/analytics/payment-methods', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = await Payment.aggregate([
      {
        $match: {
          status: 'succeeded',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$paymentMethod.brand',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get subscription status
router.get('/subscription/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('subscription billing');
    res.json({
      subscription: user.subscription,
      billing: user.billing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;