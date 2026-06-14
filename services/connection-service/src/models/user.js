import mongoose from 'mongoose';

// Lean model of the shared `users` collection (shared-DB phase). connection-
// service reads profile fields for populate and the premium flag for the swipe
// cap, and writes `blockedUsers` (block/unblock). Writing the user doc is a
// cross-context write to be resolved via the profile-service API in M6.
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    photoUrl: { type: String, default: null },
    bio: { type: String, default: '' },
    skills: { type: [String], default: [] },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
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
