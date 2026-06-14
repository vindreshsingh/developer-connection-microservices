import mongoose from 'mongoose';
import validator from 'validator';

// Ported from the monolith (backend/src/models/user.js) MINUS the auth helpers
// (getJWT/validatePassword) and credential fields it never touches — those are
// owned by identity-service. The full profile field set + validators are kept so
// `runValidators: true` on profile edits behaves exactly like the monolith.
//
// Shared-DB phase: this reads/writes the same `users` collection. The
// identity/profile field split is the later M6 DB-split step.
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: false, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: false, default: null, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: false, minlength: 8, default: null },
    photoUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || validator.isURL(v),
        message: (props) => `${props.value} is not a valid URL`,
      },
    },
    bio: { type: String, maxlength: 500, default: '' },
    skills: { type: [String], default: [] },
    blockedUsers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    githubUrl: { type: String, default: null },
    linkedinUrl: { type: String, default: null },
    age: { type: Number, min: 18, max: 75 },
    gender: {
      type: String,
      enum: { values: ['male', 'female', 'other'], message: '{VALUE} is not a valid gender' },
      validate: {
        validator: (v) => ['male', 'female', 'other'].includes(v),
        message: (props) => `${props.value} is not a valid gender`,
      },
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    coverImageUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || validator.isURL(v),
        message: (props) => `${props.value} is not a valid URL`,
      },
    },
    techStack: { type: [String], default: [] },
    experience: {
      type: [
        {
          title: { type: String, required: true, trim: true },
          company: { type: String, required: true, trim: true },
          startDate: { type: Date, required: true },
          endDate: { type: Date, default: null },
          description: { type: String, default: '', maxlength: 1000 },
        },
      ],
      default: [],
    },
    tokenVersion: { type: Number, default: 0 },
    // Read here for enrichment (decrypt accessToken) + linked-accounts; written
    // by identity-service. Cross-context read — flagged for the M6 DB split.
    oauthProviders: {
      type: [
        {
          provider: { type: String, enum: ['github', 'google', 'linkedin'], required: true },
          providerId: { type: String, required: true },
          accessToken: { type: String, default: null },
          linkedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    github: {
      username: { type: String, default: null },
      avatarUrl: { type: String, default: null },
      profileUrl: { type: String, default: null },
      topRepos: {
        type: [
          {
            name: { type: String, required: true },
            url: { type: String, required: true },
            stars: { type: Number, default: 0 },
            language: { type: String, default: null },
          },
        ],
        default: [],
      },
      topLanguages: { type: [String], default: [] },
      contributionsLastYear: { type: Number, default: null },
      syncedAt: { type: Date, default: null },
    },
    linkedin: {
      headline: { type: String, default: null },
      company: { type: String, default: null },
      jobTitle: { type: String, default: null },
      profileUrl: { type: String, default: null },
      syncedAt: { type: Date, default: null },
    },
    isPremium: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ skills: 1 });

userSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

export default mongoose.model('User', userSchema);
