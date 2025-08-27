const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripePaymentIntentId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripeInvoiceId: String,
  stripeSubscriptionId: String,
  type: {
    type: String,
    enum: ['subscription', 'one_time', 'query_pack'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'canceled', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  description: String,
  metadata: {
    subscriptionType: {
      type: String,
      enum: ['monthly', 'yearly']
    },
    queryPackSize: Number,
    planName: String
  },
  refund: {
    amount: Number,
    reason: String,
    stripeRefundId: String,
    processedAt: Date
  },
  billing: {
    name: String,
    email: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postal_code: String,
      country: String
    }
  },
  paymentMethod: {
    type: String,
    last4: String,
    brand: String,
    exp_month: Number,
    exp_year: Number
  },
  invoice: {
    number: String,
    url: String,
    pdf: String
  },
  webhookData: {
    type: mongoose.Schema.Types.Mixed
  },
  processedAt: Date,
  failureReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ createdAt: -1 });

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return (this.amount / 100).toFixed(2);
});

// Static method to get revenue statistics
paymentSchema.statics.getRevenueStats = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        status: 'succeeded',
        createdAt: {
          $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          $lte: endDate || new Date()
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          type: '$type'
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to get failed payments
paymentSchema.statics.getFailedPayments = function(limit = 50) {
  return this.find({ status: 'failed' })
    .populate('user', 'email name')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Payment', paymentSchema);