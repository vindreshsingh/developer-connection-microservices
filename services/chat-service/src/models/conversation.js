import mongoose from 'mongoose';

// Ported verbatim from the monolith (backend/src/models/conversation.js).
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'A conversation must have exactly 2 participants',
      },
    },
    lastMessageAt: { type: Date, default: null },
    lastReadBy: { type: Map, of: Date, default: {} },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1 }, { unique: true });

conversationSchema.pre('validate', function () {
  if (Array.isArray(this.participants) && this.participants.length === 2) {
    this.participants = [...this.participants].sort((a, b) => a.toString().localeCompare(b.toString()));
  }
});

export default mongoose.model('Conversation', conversationSchema);
