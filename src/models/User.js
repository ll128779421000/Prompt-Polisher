const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'monthly', 'yearly'],
      default: 'free'
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'incomplete'],
      default: 'active'
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },
  usage: {
    totalQueries: {
      type: Number,
      default: 0
    },
    currentMonthQueries: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    },
    remainingQueries: {
      type: Number,
      default: 100 // Free tier limit
    }
  },
  apiKeys: [{
    key: {
      type: String,
      unique: true,
      sparse: true
    },
    name: String,
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: Date,
    createdAt: {
      type: Date,
      default: Date.now
    },
    usageCount: {
      type: Number,
      default: 0
    }
  }],
  billing: {
    totalSpent: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    paymentMethod: {
      stripePaymentMethodId: String,
      last4: String,
      brand: String
    }
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    usageAlerts: {
      type: Boolean,
      default: true
    },
    billingAlerts: {
      type: Boolean,
      default: true
    }
  },
  security: {
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    isLocked: {
      type: Boolean,
      default: false
    },
    suspiciousActivity: [{
      type: {
        type: String,
        enum: ['unusual_usage', 'failed_payment', 'rate_limit_breach']
      },
      description: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ 'apiKeys.key': 1 });
userSchema.index({ 'subscription.stripeCustomerId': 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ 'security.lastLogin': 1 });

// Virtual for account lock status
userSchema.virtual('isAccountLocked').get(function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'security.lockUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // If we've reached max attempts, lock the account
  if (this.security.loginAttempts + 1 >= 5 && !this.isAccountLocked) {
    updates.$set = {
      'security.lockUntil': Date.now() + (2 * 60 * 60 * 1000), // 2 hours
      'security.isLocked': true
    };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    },
    $set: {
      'security.isLocked': false,
      'security.lastLogin': Date.now()
    }
  });
};

// Static method to find by API key
userSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({
    'apiKeys.key': apiKey,
    'apiKeys.isActive': true,
    isActive: true
  });
};

module.exports = mongoose.model('User', userSchema);