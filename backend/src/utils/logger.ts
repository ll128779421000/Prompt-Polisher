import winston from 'winston';

export function createLogger() {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'prompt-polisher-backend' },
    transports: [
      // Write to all logs with level `info` and below to `combined.log`
      new winston.transports.File({ 
        filename: process.env.LOG_FILE || './logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: process.env.LOG_FILE || './logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ]
  });

  // If we're not in production then log to the `console`
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return logger;
}