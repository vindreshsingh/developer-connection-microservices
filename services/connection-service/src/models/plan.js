import mongoose from 'mongoose';

// Read model for the free-tier daily swipe cap (shared-DB phase). Owned by
// billing-service; connection-service only reads `features.dailySwipeLimit`.
const featuresSchema = new mongoose.Schema(
  {
    dailySwipeLimit: { type: Number, default: null },
    advancedFilters: { type: Boolean, default: false },
    priorityGroupCalls: { type: Boolean, default: false },
    aiAssistant: { type: Boolean, default: false },
    groupCallParticipantCap: { type: Number, default: 8 },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['free', 'premium'], required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    interval: { type: String, enum: ['month'], default: 'month' },
    razorpayPlanId: { type: String, default: null },
    features: { type: featuresSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Plan', planSchema);
