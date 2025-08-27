const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  subscription_status: {
    type: DataTypes.ENUM('free', 'premium', 'enterprise'),
    defaultValue: 'free'
  },
  subscription_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  stripe_customer_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_ip: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'users',
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['stripe_customer_id']
    },
    {
      fields: ['subscription_status']
    }
  ]
});

// Instance methods
User.prototype.checkPassword = async function(password) {
  if (!this.password_hash) return false;
  return await bcrypt.compare(password, this.password_hash);
};

User.prototype.setPassword = async function(password) {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password_hash = await bcrypt.hash(password, saltRounds);
};

User.prototype.isSubscriptionActive = function() {
  if (this.subscription_status === 'free') return true;
  if (!this.subscription_end_date) return false;
  return new Date() < this.subscription_end_date;
};

// Hooks
User.beforeCreate(async (user) => {
  if (user.password_hash && !user.password_hash.startsWith('$2b$')) {
    await user.setPassword(user.password_hash);
  }
});

module.exports = User;