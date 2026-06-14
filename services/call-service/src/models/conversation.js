import mongoose from 'mongoose';

// Read model (shared-DB phase). Owned by chat-service; call-service looks up the
// 1:1 conversation to attach a call_summary message after a call ends.
const conversationSchema = new mongoose.Schema(
  {
    participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], required: true },
    lastMessageAt: { type: Date, default: null },
    lastReadBy: { type: Map, of: Date, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model('Conversation', conversationSchema);
