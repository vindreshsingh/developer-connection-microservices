import mongoose from 'mongoose';

// Lean read model of the shared `users` collection (shared-DB phase). Only the
// fields ai-service reads: auth (tokenVersion), premium gating (isPremium),
// profile context for prompts/shortlist, and the fields populated onto
// recommendations. The pre-find isActive filter mirrors the monolith so the
// recommendation shortlist never surfaces deactivated users.
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    photoUrl: { type: String, default: null },
    bio: { type: String, default: '' },
    skills: { type: [String], default: [] },
    techStack: { type: [String], default: [] },
    githubUrl: { type: String, default: null },
    linkedinUrl: { type: String, default: null },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    experience: {
      type: [
        {
          title: String,
          company: String,
          startDate: Date,
          endDate: { type: Date, default: null },
          description: { type: String, default: '' },
        },
      ],
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
