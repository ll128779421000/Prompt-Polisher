const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  stripe_payment_intent_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  stripe_charge_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount_cents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'usd'
  },
  status: {
    type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'canceled', 'refunded'),
    defaultValue: 'pending'
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'payments',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['stripe_payment_intent_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = Payment;