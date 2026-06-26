/**
 * Seeds the `free` and `premium` Plan documents (ported from the monolith's
 * backend/src/scripts/seedPlans.js). Idempotent: upserts by `key`, so it is
 * safe to re-run on every deploy.
 *
 * Run: `npm run seed` (uses MONGO_URI). The premium plan's razorpayPlanId is
 * read from RAZORPAY_PREMIUM_PLAN_ID; without it the plan still lists but is
 * not purchasable (checkout returns "This plan is not purchasable.").
 */
import mongoose from 'mongoose';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import Plan from '../models/plan.js';

const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0, // paise
    currency: 'INR',
    interval: 'month',
    razorpayPlanId: null,
    isActive: true,
    features: {
      dailySwipeLimit: 20,
      advancedFilters: false,
      priorityGroupCalls: false,
      aiAssistant: false,
      groupCallParticipantCap: 8,
    },
  },
  {
    key: 'premium',
    name: 'Premium',
    price: 10000, // paise = ₹100/month
    currency: 'INR',
    interval: 'month',
    razorpayPlanId: process.env.RAZORPAY_PREMIUM_PLAN_ID || null,
    isActive: true,
    features: {
      dailySwipeLimit: null, // unlimited
      advancedFilters: true,
      priorityGroupCalls: true,
      aiAssistant: true,
      groupCallParticipantCap: 25,
    },
  },
];

async function seed() {
  await connectMongo(MONGO_URI);
  for (const plan of PLANS) {
    await Plan.updateOne({ key: plan.key }, { $set: plan }, { upsert: true });
    console.log(`✓ upserted plan: ${plan.key} (₹${plan.price / 100}/mo, razorpayPlanId=${plan.razorpayPlanId ?? 'null'})`);
  }
  const count = await Plan.countDocuments({ isActive: true });
  console.log(`Done. Active plans in DB: ${count}`);
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
