import mongoose from 'mongoose';

// Read model (shared-DB phase). Owned by connection-service; call-service reads
// it for 1:1 call authorization (accepted-connection boundary in canUsersChat).
const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, required: true, enum: ['interested', 'ignored', 'accepted', 'rejected'] },
  },
  { timestamps: true, collection: 'connectionrequests' },
);

export default mongoose.model('ConnectionRequest', connectionRequestSchema);
