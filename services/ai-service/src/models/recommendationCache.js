import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/recommendationCache.js).
const recommendationCacheSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    recommendations: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          reason: { type: String, required: true },
        },
      ],
      default: [],
    },
    dismissed: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          dismissedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.model('RecommendationCache', recommendationCacheSchema);
