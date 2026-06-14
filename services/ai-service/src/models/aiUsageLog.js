import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/aiUsageLog.js).
const aiUsageLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: {
    type: String,
    enum: ['recommendations', 'resume-feedback', 'interview'],
    required: true,
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model('AIUsageLog', aiUsageLogSchema);
