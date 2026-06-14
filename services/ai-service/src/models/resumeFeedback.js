import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/resumeFeedback.js).
const resumeFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeUrl: { type: String, required: true },
    extractedText: { type: String, required: true },
    feedback: {
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      atsNotes: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

export default mongoose.model('ResumeFeedback', resumeFeedbackSchema);
