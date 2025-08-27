const express = require('express');
const stripeService = require('../services/stripe');
const logger = require('../utils/logger');
const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  try {
    await stripeService.handleWebhook(req.body, signature);
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

module.exports = router;