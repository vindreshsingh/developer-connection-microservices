import mongoose from 'mongoose';

// Read model for shortlist exclusions (shared-DB phase). Owned by
// connection-service; ai-service only reads it.
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
  { timestamps: true, collection: 'connectionrequests' },
);

export default mongoose.model('ConnectionRequest', connectionRequestSchema);
