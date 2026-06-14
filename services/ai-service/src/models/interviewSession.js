import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/interviewSession.js).
const interviewSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    focusArea: { type: String, default: null },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    transcript: {
      type: [
        {
          role: { type: String, enum: ['user', 'assistant'], required: true },
          content: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('InterviewSession', interviewSessionSchema);
