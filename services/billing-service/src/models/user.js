import mongoose from 'mongoose';

// Lean model of the shared `users` collection (shared-DB phase). billing-service
// reads name/email for Razorpay customer creation and is the only writer of
// `isPremium` (via BillingEventHandler) — a cross-context write to be resolved
// by an event/API in M6.
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isPremium: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

export default mongoose.model('User', userSchema);
