import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/jobPosting.js).
const jobPostingSchema = new mongoose.Schema(
  {
    postedBy: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 100, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    type: {
      type: String,
      required: true,
      enum: {
        values: ['full-time', 'part-time', 'contract', 'internship', 'freelance', 'collaboration'],
        message: '{VALUE} is not a valid job type',
      },
    },
    locationMode: {
      type: String,
      required: true,
      enum: {
        values: ['remote', 'onsite', 'hybrid'],
        message: '{VALUE} is not a valid location mode',
      },
      default: 'remote',
    },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    requiredSkills: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
    },
    salaryRange: {
      min: { type: Number, default: null, min: 0 },
      max: { type: Number, default: null, min: 0 },
      currency: { type: String, default: 'USD', trim: true, maxlength: 10 },
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    applicationCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobPostingSchema.index({ status: 1, createdAt: -1 });
jobPostingSchema.index({ deletedAt: 1, createdAt: -1 });
jobPostingSchema.index({ requiredSkills: 1 });
jobPostingSchema.index({ postedBy: 1 });

export default mongoose.model('JobPosting', jobPostingSchema);
