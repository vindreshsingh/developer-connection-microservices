import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/group.js).
const memberSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }], default: [] },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    memberCount: { type: Number, default: 1, min: 1 },
    maxMembers: { type: Number, default: 500 },
    visibility: { type: String, enum: ['public'], default: 'public' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

groupSchema.index({ tags: 1 });
groupSchema.index({ memberCount: -1 });
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ deletedAt: 1 });

groupSchema.methods.getMember = function (userId) {
  return this.members.find((m) => m.userId.equals(userId));
};
groupSchema.methods.isAdmin = function (userId) {
  const m = this.getMember(userId);
  return m?.role === 'admin';
};

export default mongoose.model('Group', groupSchema);
