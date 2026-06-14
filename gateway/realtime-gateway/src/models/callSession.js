import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/callSession.js).
// Owned by call-service; the socket layer reads/writes call lifecycle state.
const participantSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },
  },
  { _id: false },
);

const callSessionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['1:1', 'group'], required: true },
    initiatorId: { type: ObjectId, ref: 'User', required: true },
    participants: { type: [participantSchema], default: [] },
    groupId: { type: ObjectId, ref: 'Group', default: null },
    status: { type: String, enum: ['ringing', 'active', 'ended', 'missed', 'declined'], default: 'ringing' },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: null },
    isPriority: { type: Boolean, default: false },
  },
  { timestamps: true },
);

callSessionSchema.index({ 'participants.userId': 1, createdAt: -1 });
callSessionSchema.index({ groupId: 1, status: 1 });
callSessionSchema.index({ initiatorId: 1, createdAt: -1 });

callSessionSchema.methods.isParticipant = function (userId) {
  if (this.initiatorId.equals(userId)) return true;
  return this.participants.some((p) => p.userId.equals(userId));
};

export default mongoose.model('CallSession', callSessionSchema);
