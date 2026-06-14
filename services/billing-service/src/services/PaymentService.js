/**
 * PaymentService — ported verbatim from the monolith
 * (backend/src/services/PaymentService.js). Thin wrapper around the Razorpay
 * SDK + webhook signature verification, in one place.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayClient = null;

const getClient = () => {
  if (!razorpayClient) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
    }
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

export const PaymentService = {
  async createSubscription({ user, plan }) {
    const client = getClient();

    const customer = await client.customers.create({
      name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
      email: user.email ?? undefined,
      fail_existing: 0,
    });

    const rzpSubscription = await client.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      customer_notify: 1,
      total_count: 120,
      notes: { userId: user._id.toString() },
    });

    return {
      razorpaySubscriptionId: rzpSubscription.id,
      razorpayCustomerId: customer.id,
    };
  },

  async cancelSubscription(razorpaySubscriptionId) {
    const client = getClient();
    return client.subscriptions.cancel(razorpaySubscriptionId, { cancel_at_cycle_end: 1 });
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  },
};
