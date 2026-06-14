import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/postComment.js).
const postCommentSchema = new mongoose.Schema(
  {
    postId: { type: ObjectId, ref: 'Post', required: true },
    authorId: { type: ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postCommentSchema.index({ postId: 1, createdAt: 1 });

export default mongoose.model('PostComment', postCommentSchema);
