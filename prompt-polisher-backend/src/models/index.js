const sequelize = require('../config/database');
const User = require('./User');
const ApiUsage = require('./ApiUsage');
const RateLimit = require('./RateLimit');
const Payment = require('./Payment');
const ApiKey = require('./ApiKey');

// Define associations
User.hasMany(ApiUsage, { foreignKey: 'user_id', as: 'apiUsages' });
ApiUsage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Payment, { foreignKey: 'user_id', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  ApiUsage,
  RateLimit,
  Payment,
  ApiKey
};