import mongoose from 'mongoose';

// Read model (shared-DB phase). Owned by connection-service; the socket layer
// reads it for chat authorization and presence (accepted-connection fan-out).
const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, required: true, enum: ['interested', 'ignored', 'accepted', 'rejected'] },
  },
  { timestamps: true, collection: 'connectionrequests' },
);

export default mongoose.model('ConnectionRequest', connectionRequestSchema);
