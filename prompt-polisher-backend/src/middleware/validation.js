const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      errors: errors.array(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

/**
 * Sanitize and validate prompt input
 */
const validatePrompt = [
  body('prompt')
    .trim()
    .isLength({ min: 1, max: 32000 })
    .withMessage('Prompt must be between 1 and 32,000 characters')
    .matches(/^[\s\S]*$/) // Allow all characters including newlines
    .withMessage('Prompt contains invalid characters')
    .custom((value) => {
      // Check for potential code injection patterns
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /<iframe/gi,
        /<embed/gi,
        /<object/gi
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          throw new Error('Prompt contains potentially malicious content');
        }
      }
      
      return true;
    }),
    
  body('provider')
    .trim()
    .isIn(['openai', 'anthropic', 'google'])
    .withMessage('Provider must be openai, anthropic, or google'),
    
  body('model')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Model name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9-_.]+$/)
    .withMessage('Model name contains invalid characters'),
    
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
    
  body('options.maxTokens')
    .optional()
    .isInt({ min: 1, max: 4000 })
    .withMessage('maxTokens must be between 1 and 4000'),
    
  body('options.temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('temperature must be between 0 and 2'),
    
  body('options.topP')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('topP must be between 0 and 1'),
    
  body('options.frequencyPenalty')
    .optional()
    .isFloat({ min: -2, max: 2 })
    .withMessage('frequencyPenalty must be between -2 and 2'),
    
  body('options.presencePenalty')
    .optional()
    .isFloat({ min: -2, max: 2 })
    .withMessage('presencePenalty must be between -2 and 2'),
    
  handleValidationErrors
];

/**
 * Validate user registration
 */
const validateUserRegistration = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
  handleValidationErrors
];

/**
 * Validate user login
 */
const validateUserLogin = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
    
  handleValidationErrors
];

/**
 * Validate payment creation
 */
const validatePaymentIntent = [
  body('amount')
    .isFloat({ min: 0.50, max: 999.99 })
    .withMessage('Amount must be between $0.50 and $999.99'),
    
  body('currency')
    .optional()
    .trim()
    .isIn(['usd', 'eur', 'gbp', 'cad'])
    .withMessage('Currency must be usd, eur, gbp, or cad'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
    
  handleValidationErrors
];

/**
 * Validate checkout session creation
 */
const validateCheckoutSession = [
  body('priceKey')
    .trim()
    .isIn(['premium_monthly', 'premium_yearly', 'enterprise'])
    .withMessage('Invalid price key'),
    
  body('successUrl')
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Valid success URL is required'),
    
  body('cancelUrl')
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Valid cancel URL is required'),
    
  handleValidationErrors
];

/**
 * Validate UUID parameters
 */
const validateUUID = (paramName) => [
  param(paramName)
    .isUUID(4)
    .withMessage(`${paramName} must be a valid UUID`),
    
  handleValidationErrors
];

/**
 * Validate pagination parameters
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('sortBy')
    .optional()
    .trim()
    .isIn(['created_at', 'updated_at', 'cost_usd', 'response_time_ms'])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .trim()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
    
  handleValidationErrors
];

/**
 * Sanitize HTML content
 */
const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Sanitize request body recursively
 */
const sanitizeBody = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return sanitizeHtml(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Rate limiting for validation failures
 */
const validationFailureLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 validation failures per windowMs
  skip: (req) => {
    const errors = validationResult(req);
    return errors.isEmpty(); // Only count requests with validation errors
  },
  message: {
    error: 'Too many validation failures',
    message: 'Too many invalid requests from this IP'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Prevent parameter pollution
 */
const preventParameterPollution = (req, res, next) => {
  // Convert array parameters to single values (use last value)
  const cleanParams = (params) => {
    for (const key in params) {
      if (Array.isArray(params[key])) {
        params[key] = params[key][params[key].length - 1];
      }
    }
    return params;
  };

  req.query = cleanParams(req.query);
  req.body = req.body && typeof req.body === 'object' ? cleanParams(req.body) : req.body;
  
  next();
};

module.exports = {
  validatePrompt,
  validateUserRegistration,
  validateUserLogin,
  validatePaymentIntent,
  validateCheckoutSession,
  validateUUID,
  validatePagination,
  sanitizeBody,
  sanitizeHtml,
  validationFailureLimit,
  preventParameterPollution,
  handleValidationErrors
};