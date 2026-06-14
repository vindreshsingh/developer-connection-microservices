import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/jobApplication.js).
const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: ObjectId, ref: 'JobPosting', required: true },
    applicantId: { type: ObjectId, ref: 'User', required: true },
    coverNote: { type: String, trim: true, maxlength: 1000, default: '' },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

jobApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
jobApplicationSchema.index({ jobId: 1, createdAt: -1 });
jobApplicationSchema.index({ applicantId: 1, createdAt: -1 });

export default mongoose.model('JobApplication', jobApplicationSchema);
