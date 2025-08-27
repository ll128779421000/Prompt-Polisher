import { Database } from './database';
import { createLogger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger();

async function migrate() {
  try {
    logger.info('Starting database migration...');
    
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '../../logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../../data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Initialize database
    await Database.initialize();
    
    logger.info('Database migration completed successfully');
    console.log('✅ Database migration completed successfully');
    
  } catch (error: any) {
    logger.error('Database migration failed:', error);
    console.error('❌ Database migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

export { migrate };