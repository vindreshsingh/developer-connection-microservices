import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/paymentEvent.js).
// Append-only log; `razorpayEventId` unique+sparse makes webhook redelivery a
// no-op. billing-service owns this collection.
const paymentEventSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    subscriptionId: { type: ObjectId, ref: 'Subscription', default: null },
    razorpayEventId: { type: String, unique: true, sparse: true },
    type: { type: String, required: true },
    amount: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default mongoose.model('PaymentEvent', paymentEventSchema);
