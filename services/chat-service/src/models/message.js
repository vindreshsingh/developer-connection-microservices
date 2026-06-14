import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/message.js).
const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, trim: true, maxlength: 8 },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
      callId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallSession', default: null },
      duration: { type: Number, default: 0 },
      status: { type: String, default: 'ended' },
      callType: { type: String, default: '1:1' },
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ 'callSummary.callId': 1 }, { sparse: true });

messageSchema.pre('validate', function () {
  if (this.type !== 'snippet') this.language = null;
});

export default mongoose.model('Message', messageSchema);
