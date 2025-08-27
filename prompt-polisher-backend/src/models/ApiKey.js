const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  provider: {
    type: DataTypes.ENUM('openai', 'anthropic', 'google'),
    allowNull: false
  },
  key_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  key_prefix: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  usage_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_used: {
    type: DataTypes.DATE,
    allowNull: true
  },
  daily_cost_limit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 50.00
  },
  current_daily_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  cost_reset_date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  rotation_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'api_keys',
  indexes: [
    {
      fields: ['provider', 'is_active']
    },
    {
      fields: ['key_hash'],
      unique: true
    },
    {
      fields: ['cost_reset_date']
    }
  ]
});

// Instance methods
ApiKey.prototype.setKey = function(plainKey) {
  this.key_hash = crypto.createHash('sha256').update(plainKey).digest('hex');
  this.key_prefix = plainKey.substring(0, 8);
};

ApiKey.prototype.checkKey = function(plainKey) {
  const hash = crypto.createHash('sha256').update(plainKey).digest('hex');
  return this.key_hash === hash;
};

ApiKey.prototype.incrementUsage = function() {
  this.usage_count += 1;
  this.last_used = new Date();
};

ApiKey.prototype.addCost = function(cost) {
  const today = new Date().toISOString().split('T')[0];
  
  if (this.cost_reset_date !== today) {
    this.current_daily_cost = 0;
    this.cost_reset_date = today;
  }
  
  this.current_daily_cost = parseFloat(this.current_daily_cost) + cost;
};

ApiKey.prototype.hasExceededDailyLimit = function() {
  const today = new Date().toISOString().split('T')[0];
  
  if (this.cost_reset_date !== today) {
    return false; // New day, reset cost
  }
  
  return parseFloat(this.current_daily_cost) >= parseFloat(this.daily_cost_limit);
};

module.exports = ApiKey;