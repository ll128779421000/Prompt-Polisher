import express from 'express';
import { body, validationResult } from 'express-validator';
import { AdminAuth, adminLoginLimiter, requireAdmin } from '../middleware/adminAuth';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Admin login endpoint
router.post('/login',
  adminLoginLimiter,
  body('username').isLength({ min: 1, max: 50 }).matches(/^[a-zA-Z0-9_-]+$/).withMessage('Invalid username format'),
  body('password').isLength({ min: 1, max: 200 }).withMessage('Password required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const { username, password } = req.body;
      const ip = req.ip || 'unknown';

      const result = await AdminAuth.login(username, password, ip);
      
      if (!result) {
        // Don't reveal whether username or password was wrong
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      res.json({
        success: true,
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: result.user.role,
          permissions: result.user.permissions
        },
        expiresIn: '4h'
      });

    } catch (error: any) {
      logger.error('Admin login error', {
        error: error.message,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

// Admin logout endpoint
router.post('/logout',
  requireAdmin('read'),
  (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        AdminAuth.logout(token);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error: any) {
      logger.error('Admin logout error', {
        error: error.message,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Logout failed'
      });
    }
  }
);

// Verify token endpoint
router.get('/verify',
  requireAdmin('read'),
  (req, res) => {
    const user = (req as any).adminUser;
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  }
);

export { router as adminLoginRouter };