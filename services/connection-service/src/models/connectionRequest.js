import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/connectionRequest.js).
// connection-service owns this collection.
const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['interested', 'ignored', 'accepted', 'rejected'],
        message: '{VALUE} is not a valid status',
      },
    },
  },
  { timestamps: true },
);

connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

connectionRequestSchema.pre('save', function () {
  if (this.fromUserId.equals(this.toUserId))
    throw new Error('Cannot send connection request to yourself');
});

export default mongoose.model('ConnectionRequest', connectionRequestSchema);
