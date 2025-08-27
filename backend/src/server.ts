import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { Database } from './db/database';
import { authRouter } from './routes/auth';
import { promptRouter } from './routes/prompts';
import { paymentRouter } from './routes/payments';
import { adminRouter } from './routes/admin';
import { validationRouter } from './routes/validation';
import { adminLoginRouter } from './routes/adminLogin';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { 
  sanitizeInput, 
  validateRequestIntegrity, 
  trackSuspiciousActivity,
  setSecurityHeaders,
  createAdaptiveRateLimit
} from './middleware/securityMiddleware';
import { validateRequestURLs } from './middleware/urlValidation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createLogger();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// CORS configuration for extension
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Check if it's a browser extension
    if (origin.startsWith('chrome-extension://') || 
        origin.startsWith('moz-extension://') ||
        origin.startsWith('safari-web-extension://')) {
      return callback(null, true);
    }
    
    // Allow configured frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (origin === frontendUrl || origin === 'https://perfect-ai-prompts.lovable.app') {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    logger.warn('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-extension-id']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Enhanced security middleware
app.use(setSecurityHeaders);
app.use(sanitizeInput);
app.use(validateRequestIntegrity);
app.use(validateRequestURLs);
app.use(trackSuspiciousActivity);

// Adaptive rate limiting with exponential backoff
const adaptiveLimiter = createAdaptiveRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Base limit
  message: 'Too many requests from this IP, please try again later.'
});

app.use(adaptiveLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/prompts', promptRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin-auth', adminLoginRouter);
app.use('/api/validation', validationRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, async () => {
  logger.info(`🚀 Prompt Polisher Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    await Database.initialize();
    logger.info('✅ Database initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app };