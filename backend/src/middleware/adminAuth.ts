import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// Enhanced admin authentication with JWT tokens
export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
  permissions: string[];
}

// Rate limiting for admin login attempts
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many admin login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `admin_login:${req.ip}`,
});

// Admin session storage (in production, use Redis)
const adminSessions = new Map<string, { user: AdminUser, expiresAt: number }>();

export class AdminAuth {
  private static readonly ADMIN_USERS = new Map([
    ['admin', {
      id: '1',
      username: 'admin',
      passwordHash: '', // Will be set from environment
      role: 'admin' as const,
      permissions: ['read', 'write', 'delete', 'admin']
    }]
  ]);

  static async initialize() {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD environment variable is required');
    }

    if (adminPassword.length < 12) {
      throw new Error('Admin password must be at least 12 characters long');
    }

    // Hash the admin password
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminUser = this.ADMIN_USERS.get('admin');
    if (adminUser) {
      adminUser.passwordHash = passwordHash;
    }

    logger.info('Admin authentication initialized');
  }

  static async login(username: string, password: string, ip: string): Promise<{ token: string; user: AdminUser } | null> {
    const user = this.ADMIN_USERS.get(username);
    if (!user) {
      logger.warn('Admin login attempt with invalid username', { username, ip });
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Admin login attempt with invalid password', { username, ip });
      return null;
    }

    // Generate JWT token
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      ip // Bind token to IP address
    };

    const token = jwt.sign(payload, this.getJWTSecret(), {
      expiresIn: '4h', // Short session for security
      issuer: 'prompt-polisher-backend',
      audience: 'admin-panel'
    });

    // Store session
    const expiresAt = Date.now() + (4 * 60 * 60 * 1000); // 4 hours
    adminSessions.set(token, {
      user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions },
      expiresAt
    });

    logger.info('Admin login successful', { username, ip, role: user.role });

    return {
      token,
      user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions }
    };
  }

  static validateToken(token: string, requiredIP: string): AdminUser | null {
    try {
      // Verify JWT
      const decoded = jwt.verify(token, this.getJWTSecret(), {
        issuer: 'prompt-polisher-backend',
        audience: 'admin-panel'
      }) as any;

      // Check IP binding
      if (decoded.ip !== requiredIP) {
        logger.warn('Admin token used from different IP', {
          tokenIP: decoded.ip,
          requestIP: requiredIP,
          username: decoded.username
        });
        return null;
      }

      // Check session exists
      const session = adminSessions.get(token);
      if (!session || session.expiresAt < Date.now()) {
        adminSessions.delete(token);
        return null;
      }

      return session.user;
    } catch (error) {
      logger.debug('Invalid admin token', { error: (error as Error).message });
      return null;
    }
  }

  static logout(token: string) {
    adminSessions.delete(token);
  }

  static hasPermission(user: AdminUser, permission: string): boolean {
    return user.permissions.includes(permission) || user.permissions.includes('admin');
  }

  private static getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    return secret;
  }

  // Cleanup expired sessions
  static cleanupSessions() {
    const now = Date.now();
    for (const [token, session] of adminSessions.entries()) {
      if (session.expiresAt < now) {
        adminSessions.delete(token);
      }
    }
  }
}

// Middleware to require admin authentication
export function requireAdmin(permission = 'read') {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    const token = authHeader.substring(7);
    const user = AdminAuth.validateToken(token, req.ip || 'unknown');

    if (!user) {
      return res.status(401).json({
        error: 'Invalid or expired admin token',
        code: 'INVALID_ADMIN_TOKEN'
      });
    }

    if (!AdminAuth.hasPermission(user, permission)) {
      logger.warn('Admin permission denied', {
        username: user.username,
        requiredPermission: permission,
        userPermissions: user.permissions,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Add user to request
    (req as any).adminUser = user;
    next();
  };
}

// Initialize admin authentication
if (process.env.NODE_ENV !== 'test') {
  AdminAuth.initialize().catch(error => {
    logger.error('Failed to initialize admin authentication', { error: error.message });
    process.exit(1);
  });
}

// Cleanup sessions every hour
setInterval(() => {
  AdminAuth.cleanupSessions();
}, 60 * 60 * 1000);