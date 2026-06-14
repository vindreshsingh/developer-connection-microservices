import mongoose from 'mongoose';
import { getGroupConn } from '../lib/db.js';

const { ObjectId } = mongoose.Schema.Types;

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

groupMessageSchema.index({ groupId: 1, createdAt: -1, _id: -1 });
groupMessageSchema.index({ 'callSummary.callId': 1 }, { sparse: true });

groupMessageSchema.pre('validate', function () {
  if (this.type !== 'snippet') this.language = null;
});

export default function getGroupMessageModel() {
  const conn = getGroupConn();
  return conn.models.GroupMessage || conn.model('GroupMessage', groupMessageSchema);
}
