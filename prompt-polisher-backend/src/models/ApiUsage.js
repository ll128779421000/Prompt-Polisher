const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApiUsage = sequelize.define('ApiUsage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  endpoint: {
    type: DataTypes.STRING,
    allowNull: false
  },
  llm_provider: {
    type: DataTypes.ENUM('openai', 'anthropic', 'google'),
    allowNull: false
  },
  model_used: {
    type: DataTypes.STRING,
    allowNull: false
  },
  prompt_tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  completion_tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  cost_usd: {
    type: DataTypes.DECIMAL(10, 6),
    defaultValue: 0.000000
  },
  response_time_ms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referer: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'api_usage',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['ip_address']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['llm_provider']
    },
    {
      fields: ['status_code']
    },
    {
      fields: ['ip_address', 'created_at']
    }
  ]
});

module.exports = ApiUsage;