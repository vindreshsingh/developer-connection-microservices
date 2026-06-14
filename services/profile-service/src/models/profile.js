import mongoose from 'mongoose';
import validator from 'validator';

// profile-service DB (`profiles` collection). `_id` equals identity-service account `_id`.
const profileSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: false, trim: true, minlength: 2, maxlength: 50 },
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
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'profiles' },
);

profileSchema.index({ skills: 1 });

profileSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

export default mongoose.model('Profile', profileSchema);
