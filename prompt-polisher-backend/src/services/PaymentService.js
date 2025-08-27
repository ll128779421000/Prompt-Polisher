const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User, Payment } = require('../models');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.prices = {
      premium_monthly: {
        amount: 999, // $9.99
        currency: 'usd',
        interval: 'month',
        queries: 1000
      },
      premium_yearly: {
        amount: 9999, // $99.99
        currency: 'usd',
        interval: 'year',
        queries: 12000
      },
      enterprise: {
        amount: 2999, // $29.99
        currency: 'usd',
        interval: 'month',
        queries: -1 // unlimited
      }
    };
  }

  /**
   * Create Stripe customer
   */
  async createCustomer(user, metadata = {}) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
          ...metadata
        }
      });

      // Update user with Stripe customer ID
      user.stripe_customer_id = customer.id;
      await user.save();

      logger.info(`Created Stripe customer: ${customer.id} for user: ${user.id}`);
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(userId, priceKey, successUrl, cancelUrl) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const priceInfo = this.prices[priceKey];
      if (!priceInfo) {
        throw new Error('Invalid price key');
      }

      // Create or get Stripe customer
      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: priceInfo.currency,
            product_data: {
              name: `Prompt Polisher ${priceKey.replace('_', ' ')}`,
              description: `${priceInfo.queries === -1 ? 'Unlimited' : priceInfo.queries} API queries per ${priceInfo.interval}`
            },
            unit_amount: priceInfo.amount,
            ...(priceInfo.interval && {
              recurring: {
                interval: priceInfo.interval
              }
            })
          },
          quantity: 1,
        }],
        mode: priceInfo.interval ? 'subscription' : 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: user.id,
          priceKey
        }
      });

      logger.info(`Created checkout session: ${session.id} for user: ${userId}`);
      return session;
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create payment intent for one-time payment
   */
  async createPaymentIntent(userId, amount, currency = 'usd', description = '') {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create or get Stripe customer
      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        description,
        metadata: {
          userId: user.id
        }
      });

      // Record payment in database
      await Payment.create({
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'pending',
        description
      });

      logger.info(`Created payment intent: ${paymentIntent.id} for user: ${userId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment webhook
   */
  async handlePaymentSuccess(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // Update payment record
      const payment = await Payment.findOne({
        where: { stripe_payment_intent_id: paymentIntentId }
      });

      if (payment) {
        payment.status = 'succeeded';
        payment.stripe_charge_id = paymentIntent.latest_charge;
        payment.processed_at = new Date();
        await payment.save();

        // Update user subscription if applicable
        await this.updateUserSubscription(payment.user_id, paymentIntent.metadata);
        
        logger.info(`Payment successful: ${paymentIntentId}`);
      }

      return payment;
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle subscription created/updated webhook
   */
  async handleSubscriptionUpdate(subscription) {
    try {
      const customerId = subscription.customer;
      const user = await User.findOne({
        where: { stripe_customer_id: customerId }
      });

      if (!user) {
        logger.error(`User not found for Stripe customer: ${customerId}`);
        return;
      }

      // Update user subscription status
      const subscriptionStatus = this.mapStripeStatusToLocal(subscription.status);
      const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

      user.subscription_status = subscriptionStatus;
      user.subscription_end_date = subscriptionEndDate;
      await user.save();

      logger.info(`Updated subscription for user ${user.id}: ${subscriptionStatus} until ${subscriptionEndDate}`);
    } catch (error) {
      logger.error('Error handling subscription update:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.stripe_customer_id) {
        throw new Error('User or Stripe customer not found');
      }

      // Get active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active'
      });

      // Cancel all active subscriptions
      for (const subscription of subscriptions.data) {
        await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true
        });
      }

      logger.info(`Cancelled subscriptions for user: ${userId}`);
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userId, limit = 10) {
    try {
      const payments = await Payment.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit
      });

      return payments.map(payment => ({
        id: payment.id,
        amount: payment.amount_cents / 100,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        createdAt: payment.created_at,
        processedAt: payment.processed_at
      }));
    } catch (error) {
      logger.error('Error getting payment history:', error);
      throw error;
    }
  }

  /**
   * Update user subscription based on payment metadata
   */
  async updateUserSubscription(userId, metadata) {
    try {
      const user = await User.findByPk(userId);
      if (!user) return;

      const priceKey = metadata.priceKey;
      if (!priceKey || !this.prices[priceKey]) return;

      const priceInfo = this.prices[priceKey];
      const endDate = new Date();
      
      if (priceInfo.interval === 'month') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (priceInfo.interval === 'year') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      user.subscription_status = priceKey.includes('enterprise') ? 'enterprise' : 'premium';
      user.subscription_end_date = endDate;
      await user.save();

      logger.info(`Updated user ${userId} subscription: ${user.subscription_status} until ${endDate}`);
    } catch (error) {
      logger.error('Error updating user subscription:', error);
    }
  }

  /**
   * Map Stripe subscription status to local status
   */
  mapStripeStatusToLocal(stripeStatus) {
    const statusMap = {
      'active': 'premium',
      'trialing': 'premium',
      'past_due': 'premium', // Keep premium for grace period
      'canceled': 'free',
      'unpaid': 'free',
      'incomplete': 'free',
      'incomplete_expired': 'free'
    };

    return statusMap[stripeStatus] || 'free';
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload, signature, secret) {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      logger.error('Webhook signature validation failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Get available pricing plans
   */
  getPricingPlans() {
    return Object.entries(this.prices).map(([key, price]) => ({
      key,
      name: key.replace('_', ' ').toUpperCase(),
      amount: price.amount / 100,
      currency: price.currency,
      interval: price.interval,
      queries: price.queries === -1 ? 'Unlimited' : price.queries
    }));
  }
}

module.exports = new PaymentService();