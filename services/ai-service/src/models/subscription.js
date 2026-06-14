import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Read model for requirePremium's grace-period check (shared-DB phase). Owned
// by billing-service; ai-service only reads it.
const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    planId: { type: ObjectId, ref: 'Plan', required: true },
    status: {
      type: String,
      enum: ['created', 'active', 'past_due', 'cancelled', 'expired'],
      default: 'created',
    },
    razorpaySubscriptionId: { type: String, default: null, index: true },
    razorpayCustomerId: { type: String, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Subscription', subscriptionSchema);
