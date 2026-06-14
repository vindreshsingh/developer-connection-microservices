import mongoose from 'mongoose';

// Lean read model of the shared `users` collection (shared-DB phase). Used for
// auth (tokenVersion), 1:1 authorization (blockedUsers), call-incoming payloads
// (name/photo) and group-call priority (isPremium).
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    photoUrl: { type: String, default: null },
    isPremium: { type: Boolean, default: false },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

export default mongoose.model('User', userSchema);
