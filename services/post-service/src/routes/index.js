/**
 * Posts REST API — ported from the monolith (backend/src/routes/posts.js).
 * Mounted at /posts. Notifications are written directly to the shared
 * `notifications` collection (shared-DB phase); the realtime emit moves in M5.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import userAuth from '../middlewares/auth.js';
import { uploadImageBuffer } from '@dc/cloudinary';
import { getExcludedUserIds } from '../lib/blocking.js';
import Post from '../models/post.js';
import PostComment from '../models/postComment.js';
import Notification from '../models/notification.js';
import ConnectionRequest from '../models/connectionRequest.js';

const router = Router();

const PAGE_SIZE = 10;
const COMMENT_PAGE_SIZE = 20;
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getConnectionIds = async (userId) => {
  const connections = await ConnectionRequest.find({
    $or: [
      { fromUserId: userId, status: 'accepted' },
      { toUserId: userId, status: 'accepted' },
    ],
  }).select('fromUserId toUserId');
  return connections.map((c) => (c.fromUserId.equals(userId) ? c.toUserId : c.fromUserId));
};

const formatPost = (postDoc, userId) => {
  const likedByMe = postDoc.isLikedBy(userId);
  const obj = postDoc.toObject();
  delete obj.likes;
  obj.likedByMe = likedByMe;
  return obj;
};

router.use(userAuth);

// POST /posts
router.post('/', async (req, res) => {
  try {
    const { content, codeSnippet, images } = req.body;

    const trimmedContent = content?.trim() ?? '';
    const code = codeSnippet?.code?.trim();
    const postImages = Array.isArray(images) ? images : [];

    if (!trimmedContent && !code && postImages.length === 0)
      return res.status(400).json({ error: 'Post must include text, a code snippet, or at least one image.' });

    if (postImages.length > MAX_IMAGES)
      return res.status(400).json({ error: `A post can include at most ${MAX_IMAGES} images.` });

    const post = await Post.create({
      authorId: req.user._id,
      content: trimmedContent,
      codeSnippet: code ? { code, language: codeSnippet?.language?.trim() || null } : undefined,
      images: postImages,
    });

    await post.populate('authorId', 'firstName lastName photoUrl');

    res.status(201).json({ message: 'Post created.', post: formatPost(post, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /posts/upload-image
router.post(
  '/upload-image',
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided' });
      const result = await uploadImageBuffer(req.file.buffer, 'posts');
      res.status(200).json({ url: result.secure_url });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// GET /posts
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const scope = req.query.scope === 'public' ? 'public' : 'network';

    const excludedIds = await getExcludedUserIds(req.user);

    const filter = { deletedAt: null };
    if (scope === 'network') {
      const connectionIds = await getConnectionIds(req.user._id);
      const allowedIds = [req.user._id, ...connectionIds].filter(
        (id) => !excludedIds.some((excluded) => excluded.equals(id)),
      );
      filter.authorId = { $in: allowedIds };
    } else {
      filter.authorId = { $nin: excludedIds };
    }

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('authorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: posts.map((post) => formatPost(post, req.user._id)),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasNextPage: page * PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /posts/:postId
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null }).populate(
      'authorId',
      'firstName lastName photoUrl',
    );
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    res.status(200).json({ post: formatPost(post, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /posts/:postId
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (!post.authorId.equals(req.user._id))
      return res.status(403).json({ error: 'You can only delete your own posts.' });

    post.deletedAt = new Date();
    await post.save();

    res.status(200).json({ message: 'Post deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /posts/:postId/like
router.post('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const alreadyLiked = post.isLikedBy(req.user._id);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => !id.equals(req.user._id));
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      post.likes.push(req.user._id);
      post.likeCount += 1;
    }

    await post.save();

    if (!alreadyLiked && !post.authorId.equals(req.user._id)) {
      await Notification.create({
        recipientId: post.authorId,
        actorId: req.user._id,
        type: 'post_like',
        postId: post._id,
      });
    }

    res.status(200).json({ liked: !alreadyLiked, likeCount: post.likeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /posts/:postId/comments
router.get('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { postId, deletedAt: null };

    const total = await PostComment.countDocuments(filter);
    const comments = await PostComment.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * COMMENT_PAGE_SIZE)
      .limit(COMMENT_PAGE_SIZE)
      .populate('authorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: comments,
      pagination: {
        page,
        pageSize: COMMENT_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / COMMENT_PAGE_SIZE),
        hasNextPage: page * COMMENT_PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /posts/:postId/comments
router.post('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const content = req.body.content?.trim();
    if (!content) return res.status(400).json({ error: 'Comment content is required.' });
    if (content.length > 1000) return res.status(400).json({ error: 'Comment cannot exceed 1000 characters.' });

    const comment = await PostComment.create({ postId: post._id, authorId: req.user._id, content });

    post.commentCount += 1;
    await post.save();

    await comment.populate('authorId', 'firstName lastName photoUrl');

    if (!post.authorId.equals(req.user._id)) {
      await Notification.create({
        recipientId: post.authorId,
        actorId: req.user._id,
        type: 'post_comment',
        postId: post._id,
      });
    }

    res.status(201).json({ message: 'Comment added.', comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /posts/:postId/comments/:commentId
router.delete('/:postId/comments/:commentId', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    if (!validObjectId(postId) || !validObjectId(commentId))
      return res.status(404).json({ error: 'Comment not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = await PostComment.findOne({ _id: commentId, postId, deletedAt: null });
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const isCommentAuthor = comment.authorId.equals(req.user._id);
    const isPostAuthor = post.authorId.equals(req.user._id);
    if (!isCommentAuthor && !isPostAuthor)
      return res.status(403).json({ error: 'You cannot delete this comment.' });

    comment.deletedAt = new Date();
    await comment.save();

    post.commentCount = Math.max(0, post.commentCount - 1);
    await post.save();

    res.status(200).json({ message: 'Comment deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
