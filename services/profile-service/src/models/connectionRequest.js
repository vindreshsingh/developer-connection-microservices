import mongoose from 'mongoose';

// Lean read-model of the monolith's connectionRequest collection. profile-service
// only needs it to exclude already-interacted users from the discovery feed.
// Owned by connection-service — cross-context read, flagged for the M6 split.
const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['interested', 'ignored', 'accepted', 'rejected'],
    },
  },
  { timestamps: true },
);

connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

export default mongoose.model('ConnectionRequest', connectionRequestSchema);
