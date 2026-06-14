import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Read/write model (shared-DB phase). Owned by group-service; call-service
// upserts a `call_summary` message into the group thread after a group call ends.
const reactionSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, trim: true, maxlength: 8 },
  },
  { _id: false },
);

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: { type: ObjectId, ref: 'Group', required: true },
    senderId: { type: ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: { values: ['text', 'snippet', 'call_summary'], message: '{VALUE} is not a valid message type' },
      default: 'text',
    },
    body: {
      type: String,
      required: function () { return this.type !== 'call_summary'; },
      trim: true,
      maxlength: 10000,
      default: null,
    },
    language: { type: String, default: null, trim: true, maxlength: 32 },
    reactions: { type: [reactionSchema], default: [] },
    callSummary: {
      callId: { type: ObjectId, ref: 'CallSession', default: null },
      duration: { type: Number, default: 0 },
      status: { type: String, default: 'ended' },
      callType: { type: String, default: 'group' },
    },
  },
  { timestamps: true },
);

groupMessageSchema.index({ 'callSummary.callId': 1 }, { sparse: true });

export default mongoose.model('GroupMessage', groupMessageSchema);
