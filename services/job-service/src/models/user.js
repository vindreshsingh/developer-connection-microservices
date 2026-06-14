import mongoose from 'mongoose';

// Lean read model of the shared `users` collection (shared-DB phase): the
// fields job-service reads for auth, block exclusions, skill-match scoring, and
// applicant/poster populate.
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    photoUrl: { type: String, default: null },
    skills: { type: [String], default: [] },
    techStack: { type: [String], default: [] },
    githubUrl: { type: String, default: null },
    linkedinUrl: { type: String, default: null },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    experience: { type: Array, default: [] },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

export default mongoose.model('User', userSchema);
