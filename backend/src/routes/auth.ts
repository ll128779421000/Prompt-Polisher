import express from 'express';
import { body, validationResult } from 'express-validator';
import { Database } from '../db/database';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const logger = createLogger();

// Get or create user by IP
router.post('/user', async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    let user = await Database.getUserByIP(ipAddress);
    
    if (!user) {
      // Create new user
      user = await Database.createUser({
        id: uuidv4(),
        ip_address: ipAddress,
        queries_today: 0,
        total_queries: 0,
        last_query_date: new Date().toISOString().split('T')[0]
      });
      
      logger.info('New user created', {
        userId: user.id,
        ipAddress
      });
    }
    
    res.json({
      user: {
        id: user.id,
        isPremium: user.is_premium,
        queriesUsed: user.queries_today,
        queriesLimit: user.is_premium ? 'unlimited' : 5,
        totalQueries: user.total_queries
      }
    });
    
  } catch (error: any) {
    logger.error('User creation/retrieval failed', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to get user information'
    });
  }
});

// Update user email (optional)
router.post('/update-email',
  body('email').isEmail().withMessage('Invalid email format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      
      const { email } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      
      const user = await Database.getUserByIP(ipAddress);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }
      
      await Database.updateUser(user.id, { email });
      
      res.json({
        success: true,
        message: 'Email updated successfully'
      });
      
    } catch (error: any) {
      logger.error('Email update failed', {
        error: error.message
      });
      
      res.status(500).json({
        error: 'Failed to update email'
      });
    }
  }
);

export { router as authRouter };