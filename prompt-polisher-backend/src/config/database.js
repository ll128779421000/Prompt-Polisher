const { Sequelize } = require('sequelize');
const path = require('path');

const isDevelopment = process.env.NODE_ENV === 'development';

// Database configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_URL?.replace('sqlite:', '') || path.join(__dirname, '../../data/prompt_polisher.db'),
  logging: isDevelopment ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft deletes
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// For PostgreSQL in production:
// const sequelize = new Sequelize(process.env.DATABASE_URL, {
//   dialect: 'postgres',
//   logging: isDevelopment ? console.log : false,
//   define: {
//     timestamps: true,
//     underscored: true,
//     paranoid: true,
//   },
//   pool: {
//     max: 20,
//     min: 0,
//     acquire: 30000,
//     idle: 10000
//   }
// });

module.exports = sequelize;