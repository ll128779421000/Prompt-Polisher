const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RateLimit = sequelize.define('RateLimit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  identifier: {
    type: DataTypes.STRING, // IP address or user ID
    allowNull: false
  },
  identifier_type: {
    type: DataTypes.ENUM('ip', 'user'),
    allowNull: false
  },
  endpoint: {
    type: DataTypes.STRING,
    allowNull: false
  },
  requests_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  window_start: {
    type: DataTypes.DATE,
    allowNull: false
  },
  window_end: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_blocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  block_reason: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'rate_limits',
  indexes: [
    {
      fields: ['identifier', 'endpoint', 'window_start'],
      unique: true
    },
    {
      fields: ['window_end']
    },
    {
      fields: ['is_blocked']
    }
  ]
});

module.exports = RateLimit;