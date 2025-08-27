const Stripe = require('stripe');
const User = require('../models/User');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');

class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Pricing configurations
    this.prices = {
      monthly: {
        amount: Math.round(parseFloat(process.env.MONTHLY_SUBSCRIPTION_PRICE || 29.99) * 100),
        currency: 'usd',
        interval: 'month'
      },
      yearly: {
        amount: Math.round(parseFloat(process.env.YEARLY_SUBSCRIPTION_PRICE || 299.99) * 100),
        currency: 'usd',
        interval: 'year'
      },
      queryPacks: {
        100: Math.round(parseFloat(process.env.QUERY_PACK_100_PRICE || 5.00) * 100),
        500: Math.round(parseFloat(process.env.QUERY_PACK_500_PRICE || 20.00) * 100),
        1000: Math.round(parseFloat(process.env.QUERY_PACK_1000_PRICE || 35.00) * 100)
      }
    };
  }

  // Create or get Stripe customer
  async createOrGetCustomer(user) {
    try {
      if (user.subscription.stripeCustomerId) {
        // Retrieve existing customer
        const customer = await this.stripe.customers.retrieve(user.subscription.stripeCustomerId);
        return customer;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString()
        }
      });

      // Update user with customer ID
      await User.findByIdAndUpdate(user._id, {
        'subscription.stripeCustomerId': customer.id
      });

      logger.info(`Created Stripe customer ${customer.id} for user ${user._id}`);
      return customer;
    } catch (error) {
      logger.error('Error creating/getting Stripe customer:', error);
      throw error;
    }
  }

  // Create subscription
  async createSubscription(userId, priceType, paymentMethodId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const customer = await this.createOrGetCustomer(user);

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });

      // Set as default payment method
      await this.stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      // Create price if it doesn't exist
      const price = await this.createOrGetPrice(priceType);

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user._id.toString(),
          subscriptionType: priceType
        }
      });

      // Update user subscription info
      await User.findByIdAndUpdate(userId, {
        'subscription.type': priceType,
        'subscription.stripeSubscriptionId': subscription.id,
        'subscription.status': subscription.status,
        'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
      });

      // Create payment record
      await this.createPaymentRecord(user, {
        stripePaymentIntentId: subscription.latest_invoice.payment_intent.id,
        stripeSubscriptionId: subscription.id,
        type: 'subscription',
        amount: this.prices[priceType].amount,
        description: `${priceType} subscription`,
        metadata: { subscriptionType: priceType }
      });

      logger.info(`Created subscription ${subscription.id} for user ${userId}`);
      return subscription;
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Create one-time payment for query packs
  async createQueryPackPayment(userId, packSize) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const customer = await this.createOrGetCustomer(user);
      const amount = this.prices.queryPacks[packSize];

      if (!amount) throw new Error('Invalid query pack size');

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customer.id,
        description: `Query pack - ${packSize} queries`,
        metadata: {
          userId: user._id.toString(),
          queryPackSize: packSize.toString(),
          type: 'query_pack'
        }
      });

      // Create payment record
      await this.createPaymentRecord(user, {
        stripePaymentIntentId: paymentIntent.id,
        type: 'query_pack',
        amount,
        description: `Query pack - ${packSize} queries`,
        metadata: { queryPackSize: packSize }
      });

      logger.info(`Created query pack payment ${paymentIntent.id} for user ${userId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Error creating query pack payment:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription(userId, immediately = false) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.subscription.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      let subscription;
      if (immediately) {
        subscription = await this.stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
      } else {
        subscription = await this.stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
      }

      // Update user subscription
      await User.findByIdAndUpdate(userId, {
        'subscription.status': subscription.status,
        'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end
      });

      logger.info(`Cancelled subscription ${subscription.id} for user ${userId}`);
      return subscription;
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  // Process refund
  async processRefund(paymentId, amount = null, reason = 'requested_by_customer') {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) throw new Error('Payment not found');

      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount || payment.amount,
        reason
      });

      // Update payment record
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'refunded',
        'refund.amount': refund.amount,
        'refund.reason': reason,
        'refund.stripeRefundId': refund.id,
        'refund.processedAt': new Date()
      });

      logger.info(`Processed refund ${refund.id} for payment ${paymentId}`);
      return refund;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  // Create or get price
  async createOrGetPrice(priceType) {
    try {
      const priceConfig = this.prices[priceType];
      if (!priceConfig) throw new Error('Invalid price type');

      // Try to find existing price
      const prices = await this.stripe.prices.list({
        product: process.env.STRIPE_PRODUCT_ID,
        active: true
      });

      let existingPrice = prices.data.find(price => 
        price.unit_amount === priceConfig.amount &&
        price.currency === priceConfig.currency &&
        price.recurring?.interval === priceConfig.interval
      );

      if (existingPrice) return existingPrice;

      // Create new price
      const price = await this.stripe.prices.create({
        unit_amount: priceConfig.amount,
        currency: priceConfig.currency,
        product: process.env.STRIPE_PRODUCT_ID,
        recurring: priceConfig.interval ? {
          interval: priceConfig.interval
        } : undefined,
        metadata: {
          type: priceType
        }
      });

      return price;
    } catch (error) {
      logger.error('Error creating/getting price:', error);
      throw error;
    }
  }

  // Create payment record
  async createPaymentRecord(user, paymentData) {
    try {
      const payment = new Payment({
        user: user._id,
        ...paymentData
      });

      await payment.save();
      return payment;
    } catch (error) {
      logger.error('Error creating payment record:', error);
      throw error;
    }
  }

  // Handle webhook events
  async handleWebhook(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      logger.info(`Received Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  // Handle successful payment
  async handlePaymentSucceeded(paymentIntent) {
    try {
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntent.id
      });

      if (payment) {
        payment.status = 'succeeded';
        payment.processedAt = new Date();
        payment.webhookData = paymentIntent;
        await payment.save();

        // If it's a query pack, add queries to user account
        if (payment.type === 'query_pack') {
          await User.findByIdAndUpdate(payment.user, {
            $inc: {
              'usage.remainingQueries': payment.metadata.queryPackSize,
              'billing.totalSpent': payment.amount / 100
            }
          });
        }

        logger.info(`Payment succeeded: ${paymentIntent.id}`);
      }
    } catch (error) {
      logger.error('Error handling payment succeeded:', error);
    }
  }

  // Handle failed payment
  async handlePaymentFailed(paymentIntent) {
    try {
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntent.id
      });

      if (payment) {
        payment.status = 'failed';
        payment.failureReason = paymentIntent.last_payment_error?.message;
        payment.webhookData = paymentIntent;
        await payment.save();

        logger.info(`Payment failed: ${paymentIntent.id}`);
      }
    } catch (error) {
      logger.error('Error handling payment failed:', error);
    }
  }

  // Handle subscription events
  async handleSubscriptionUpdated(subscription) {
    try {
      const user = await User.findOne({
        'subscription.stripeSubscriptionId': subscription.id
      });

      if (user) {
        user.subscription.status = subscription.status;
        user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;

        // Reset usage for active subscriptions
        if (subscription.status === 'active') {
          user.usage.remainingQueries = -1; // Unlimited for subscriptions
        }

        await user.save();
        logger.info(`Subscription updated: ${subscription.id}`);
      }
    } catch (error) {
      logger.error('Error handling subscription updated:', error);
    }
  }

  async handleSubscriptionDeleted(subscription) {
    try {
      const user = await User.findOne({
        'subscription.stripeSubscriptionId': subscription.id
      });

      if (user) {
        user.subscription.type = 'free';
        user.subscription.status = 'canceled';
        user.usage.remainingQueries = parseInt(process.env.FREE_TIER_LIMIT || 100);
        await user.save();

        logger.info(`Subscription deleted: ${subscription.id}`);
      }
    } catch (error) {
      logger.error('Error handling subscription deleted:', error);
    }
  }
}

module.exports = new StripeService();