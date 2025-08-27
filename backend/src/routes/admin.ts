import express from 'express';
import { Database } from '../db/database';
import { LLMProvider } from '../services/llmProvider';
import { createLogger } from '../utils/logger';
import { requireAdmin } from '../middleware/adminAuth';

const router = express.Router();
const logger = createLogger();

// Get system statistics
router.get('/stats', requireAdmin('read'), async (req, res) => {
  try {
    const stats = await Database.getUsageStats();
    const providerStatus = LLMProvider.getProviderStatus();
    
    res.json({
      usage: stats,
      providers: providerStatus,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get recent usage logs
router.get('/usage/:limit?', requireAdmin('read'), async (req, res) => {
  try {
    const limit = parseInt(req.params.limit || '100');
    
    // This would need additional database methods
    // For now, return basic info
    res.json({
      message: 'Usage logs endpoint - implement based on your logging needs',
      limit
    });
    
  } catch (error: any) {
    logger.error('Admin usage logs error', { error: error.message });
    res.status(500).json({ error: 'Failed to get usage logs' });
  }
});

// System health check
router.get('/health', requireAdmin('read'), async (req, res) => {
  try {
    const dbHealthy = await Database.getUsageStats();
    const llmHealthy = await LLMProvider.testConnection();
    
    const health = {
      database: !!dbHealthy,
      llmProvider: llmHealthy,
      overall: !!dbHealthy && llmHealthy
    };
    
    res.status(health.overall ? 200 : 503).json({
      status: health.overall ? 'healthy' : 'unhealthy',
      checks: health,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('Admin health check error', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

export { router as adminRouter };