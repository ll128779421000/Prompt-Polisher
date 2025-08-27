import express from 'express';
import Stripe from 'stripe';
import { body, validationResult } from 'express-validator';
import { Database } from '../db/database';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const logger = createLogger();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Pricing configuration
const PRICING = {
  queries_100: {
    amount: 500, // $5.00
    queries: 100,
    name: '100 Queries Pack',
    description: 'Perfect for regular users'
  },
  queries_500: {
    amount: 2000, // $20.00
    queries: 500,
    name: '500 Queries Pack',
    description: 'Best value for power users'
  },
  monthly_premium: {
    amount: 999, // $9.99/month
    queries: -1, // Unlimited
    name: 'Monthly Premium',
    description: 'Unlimited queries per month'
  },
  yearly_premium: {
    amount: 9999, // $99.99/year
    queries: -1, // Unlimited
    name: 'Yearly Premium',
    description: 'Unlimited queries - save 17%'
  }
};

// Create payment intent
router.post('/create-payment-intent',
  body('plan').isIn(Object.keys(PRICING)).withMessage('Invalid plan selected'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { plan, email } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Get or create user
      let user = await Database.getUserByIP(ipAddress);
      if (!user) {
        user = await Database.createUser({
          id: uuidv4(),
          ip_address: ipAddress,
          email: email || undefined
        });
      } else if (email && !user.email) {
        await Database.updateUser(user.id, { email });
      }

      const planDetails = PRICING[plan as keyof typeof PRICING];
      
      // Create Stripe customer if not exists
      let stripeCustomer;
      if (user.stripe_customer_id) {
        stripeCustomer = await stripe.customers.retrieve(user.stripe_customer_id);
      } else {
        stripeCustomer = await stripe.customers.create({
          email: email || undefined,
          metadata: {
            userId: user.id,
            ipAddress
          }
        });
        
        await Database.updateUser(user.id, {
          stripe_customer_id: stripeCustomer.id
        });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: planDetails.amount,
        currency: 'usd',
        customer: stripeCustomer.id,
        metadata: {
          userId: user.id,
          plan,
          queriesPurchased: planDetails.queries.toString(),
          ipAddress
        },
        description: `${planDetails.name} - ${planDetails.description}`,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Store payment record
      await Database.createPayment({
        user_id: user.id,
        stripe_payment_id: paymentIntent.id,
        amount: planDetails.amount / 100, // Convert to dollars
        currency: 'usd',
        status: 'pending',
        queries_purchased: planDetails.queries
      });

      logger.info(`Payment intent created`, {
        userId: user.id,
        plan,
        amount: planDetails.amount,
        paymentIntentId: paymentIntent.id
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        plan: planDetails,
        user: {
          id: user.id,
          email: user.email,
          isPremium: user.is_premium
        }
      });

    } catch (error: any) {
      logger.error('Payment intent creation failed', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        error: 'Payment processing failed',
        message: 'Unable to create payment intent. Please try again.'
      });
    }
  }
);

// Stripe webhook handler
router.post('/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured');
      return res.status(400).send('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      logger.error('Webhook signature verification failed', {
        error: err.message
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
          
        case 'payment_intent.payment_failed':
          await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
          break;

        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });

    } catch (error: any) {
      logger.error('Webhook processing failed', {
        eventType: event.type,
        error: error.message
      });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata.userId;
  const plan = paymentIntent.metadata.plan;
  const queriesPurchased = parseInt(paymentIntent.metadata.queriesPurchased || '0');

  logger.info(`Payment succeeded`, {
    userId,
    plan,
    amount: paymentIntent.amount,
    paymentIntentId: paymentIntent.id
  });

  // Update payment record
  await Database.updatePaymentStatus(paymentIntent.id, 'completed');

  // Update user based on plan
  const planDetails = PRICING[plan as keyof typeof PRICING];
  
  if (plan.includes('premium')) {
    // Premium subscription
    const isYearly = plan.includes('yearly');
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (isYearly ? 12 : 1));

    await Database.updateUser(userId, {
      is_premium: true,
      premium_expires_at: expiryDate.toISOString()
    });

    logger.info(`User upgraded to premium`, {
      userId,
      plan,
      expiresAt: expiryDate.toISOString()
    });
  } else {
    // Query pack purchase - extend current queries
    // Note: This would require additional logic to track purchased queries
    logger.info(`Query pack purchased`, {
      userId,
      queriesPurchased
    });
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata.userId;
  
  logger.warn(`Payment failed`, {
    userId,
    paymentIntentId: paymentIntent.id,
    lastPaymentError: paymentIntent.last_payment_error
  });

  // Update payment record
  await Database.updatePaymentStatus(paymentIntent.id, 'failed');
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (!customer || customer.deleted) return;

  const userId = (customer as Stripe.Customer).metadata?.userId;
  if (!userId) return;

  const isActive = subscription.status === 'active';
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  await Database.updateUser(userId, {
    is_premium: isActive,
    premium_expires_at: isActive ? currentPeriodEnd.toISOString() : undefined
  });

  logger.info(`Subscription updated`, {
    userId,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd
  });
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (!customer || customer.deleted) return;

  const userId = (customer as Stripe.Customer).metadata?.userId;
  if (!userId) return;

  // Don't immediately revoke premium - let it expire naturally
  logger.info(`Subscription cancelled`, {
    userId,
    subscriptionId: subscription.id,
    canceledAt: subscription.canceled_at
  });
}

// Get pricing information
router.get('/pricing', (req, res) => {
  const pricing = Object.entries(PRICING).map(([key, value]) => ({
    id: key,
    ...value,
    amount: value.amount / 100 // Convert to dollars for display
  }));

  res.json({ pricing });
});

// Get user payment history
router.get('/history/:userId?', async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.params.userId;

    let user;
    if (userId) {
      user = await Database.getUserById(userId);
    } else {
      user = await Database.getUserByIP(ipAddress);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // This would require additional query methods in Database class
    // For now, return basic user info
    res.json({
      user: {
        id: user.id,
        isPremium: user.is_premium,
        premiumExpiresAt: user.premium_expires_at,
        stripeCustomerId: user.stripe_customer_id ? 'configured' : 'not_set'
      },
      payments: [] // Would fetch from payments table
    });

  } catch (error: any) {
    logger.error('Payment history retrieval failed', {
      error: error.message
    });

    res.status(500).json({
      error: 'Failed to retrieve payment history'
    });
  }
});

export { router as paymentRouter };