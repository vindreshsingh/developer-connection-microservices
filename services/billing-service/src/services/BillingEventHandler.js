/**
 * BillingEventHandler — ported verbatim from the monolith
 * (backend/src/services/BillingEventHandler.js). The only code path that writes
 * Subscription.status and User.isPremium. State updates are idempotent, and the
 * webhook route dedupes by PaymentEvent.razorpayEventId before calling handle().
 *
 * NOTE (shared-DB phase): writing User.isPremium is a cross-context write. In
 * M6 this becomes a `billing.subscription.*` event that profile/identity
 * consumes to flip its own denormalized flag.
 */

import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import PaymentEvent from '../models/paymentEvent.js';

const toDate = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000) : null);

export const BillingEventHandler = {
  async handle(payload, eventId) {
    const eventType = payload.event;
    const data = payload.payload || {};
    const subEntity = data.subscription?.entity;
    const paymentEntity = data.payment?.entity;

    const razorpaySubscriptionId = subEntity?.id || paymentEntity?.subscription_id || null;

    const subscription = razorpaySubscriptionId
      ? await Subscription.findOne({ razorpaySubscriptionId })
      : null;

    if (subscription) {
      switch (eventType) {
        case 'subscription.activated':
          subscription.status = 'active';
          subscription.currentPeriodStart = toDate(subEntity.current_start);
          subscription.currentPeriodEnd = toDate(subEntity.current_end);
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: true });
          break;

        case 'subscription.charged':
          subscription.status = 'active';
          if (subEntity?.current_start) subscription.currentPeriodStart = toDate(subEntity.current_start);
          if (subEntity?.current_end) subscription.currentPeriodEnd = toDate(subEntity.current_end);
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: true });
          break;

        case 'payment.failed':
          subscription.status = 'past_due';
          await subscription.save();
          break;

        case 'subscription.cancelled':
          subscription.status = 'cancelled';
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: false });
          break;

        case 'subscription.completed':
        case 'subscription.expired':
          subscription.status = 'expired';
          await subscription.save();
          await User.findByIdAndUpdate(subscription.userId, { isPremium: false });
          break;

        default:
          break;
      }
    }

    const userId = subscription?.userId || subEntity?.notes?.userId || paymentEntity?.notes?.userId || null;

    if (!userId) return;

    await PaymentEvent.create({
      userId,
      subscriptionId: subscription?._id ?? null,
      razorpayEventId: eventId || undefined,
      type: eventType,
      amount: paymentEntity?.amount ?? null,
      currency: paymentEntity?.currency ?? 'INR',
      rawPayload: payload,
    });
  },
};
