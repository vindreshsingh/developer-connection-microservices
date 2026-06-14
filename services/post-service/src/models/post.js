import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Ported verbatim from the monolith (backend/src/models/post.js).
const postSchema = new mongoose.Schema(
  {
    authorId: { type: ObjectId, ref: 'User', required: true },
    content: { type: String, trim: true, maxlength: 3000, default: '' },
    codeSnippet: {
      code: { type: String, default: null, maxlength: 10000 },
      language: { type: String, default: null, trim: true, maxlength: 32 },
    },
    images: { type: [String], default: [] },
    tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }], default: [] },
    likes: { type: [{ type: ObjectId, ref: 'User' }], default: [] },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ deletedAt: 1, createdAt: -1 });
postSchema.index({ tags: 1 });

postSchema.methods.isLikedBy = function (userId) {
  return this.likes.some((id) => id.equals(userId));
};

export default mongoose.model('Post', postSchema);
