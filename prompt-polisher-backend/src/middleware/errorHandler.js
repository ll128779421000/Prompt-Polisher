const logger = require('../utils/logger');

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom error classes for specific scenarios
 */
class ValidationError extends ApiError {
  constructor(message, details = []) {
    super(message, 400, true);
    this.details = details;
  }
}

class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true);
  }
}

class AuthorizationError extends ApiError {
  constructor(message = 'Access denied') {
    super(message, 403, true);
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);
  }
}

class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 429, true);
    this.retryAfter = retryAfter;
  }
}

class PaymentError extends ApiError {
  constructor(message = 'Payment processing failed') {
    super(message, 402, true);
  }
}

class ExternalServiceError extends ApiError {
  constructor(message = 'External service error', service = 'unknown') {
    super(message, 503, true);
    this.service = service;
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logError(err, req);

  // Mongoose/Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const message = 'Validation Error';
    const details = err.errors.map(val => ({
      field: val.path,
      message: val.message
    }));
    error = new ValidationError(message, details);
  }

  // Mongoose/Sequelize duplicate key error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Duplicate field value entered';
    error = new ValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AuthenticationError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AuthenticationError(message);
  }

  // Sequelize database connection error
  if (err.name === 'SequelizeConnectionError') {
    const message = 'Database connection error';
    error = new ApiError(message, 503, true);
  }

  // Stripe errors
  if (err.type && err.type.includes('Stripe')) {
    const message = err.message || 'Payment processing error';
    error = new PaymentError(message);
  }

  // Axios/HTTP errors
  if (err.response && err.config) {
    const service = err.config.baseURL || 'external service';
    const message = `External service error: ${err.response.status}`;
    error = new ExternalServiceError(message, service);
  }

  // Send error response
  sendErrorResponse(error, res);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  const error = new NotFoundError(message);
  next(error);
};

/**
 * Async error wrapper to catch async errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Log error details
 */
const logError = (err, req) => {
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.body,
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString()
  };

  // Log based on severity
  if (err.statusCode >= 500) {
    logger.error('Server Error:', errorInfo);
  } else if (err.statusCode >= 400) {
    logger.warn('Client Error:', errorInfo);
  } else {
    logger.info('Error:', errorInfo);
  }

  // Special handling for security-related errors
  if (err.statusCode === 401 || err.statusCode === 403) {
    logger.warn('Security Event:', {
      type: 'authentication_failure',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }

  // Log rate limit violations
  if (err instanceof RateLimitError) {
    logger.warn('Rate Limit Event:', {
      type: 'rate_limit_exceeded',
      ip: req.ip,
      userId: req.user?.id,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Send formatted error response
 */
const sendErrorResponse = (err, res) => {
  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
  }

  const errorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      ...(err.details && { details: err.details }),
      ...(err.retryAfter && { retryAfter: err.retryAfter }),
      ...(err.service && { service: err.service }),
      ...(process.env.NODE_ENV === 'development' && err.stack && { stack: err.stack })
    }
  };

  // Add specific error codes for different types
  switch (err.constructor.name) {
    case 'ValidationError':
      errorResponse.error.code = 'VALIDATION_ERROR';
      break;
    case 'AuthenticationError':
      errorResponse.error.code = 'AUTHENTICATION_ERROR';
      break;
    case 'AuthorizationError':
      errorResponse.error.code = 'AUTHORIZATION_ERROR';
      break;
    case 'NotFoundError':
      errorResponse.error.code = 'NOT_FOUND_ERROR';
      break;
    case 'RateLimitError':
      errorResponse.error.code = 'RATE_LIMIT_ERROR';
      break;
    case 'PaymentError':
      errorResponse.error.code = 'PAYMENT_ERROR';
      break;
    case 'ExternalServiceError':
      errorResponse.error.code = 'EXTERNAL_SERVICE_ERROR';
      break;
    default:
      errorResponse.error.code = 'INTERNAL_ERROR';
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
      reason,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

/**
 * Initialize error handling
 */
const initializeErrorHandling = () => {
  handleUncaughtException();
  handleUnhandledRejection();
};

module.exports = {
  // Error classes
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  PaymentError,
  ExternalServiceError,
  
  // Middleware
  errorHandler,
  notFoundHandler,
  catchAsync,
  
  // Utilities
  logError,
  sendErrorResponse,
  initializeErrorHandling
};