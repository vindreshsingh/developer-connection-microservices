/**
 * Chat REST API — ported from the monolith (backend/src/routes/chat.js).
 * Mounted at /chat. Owns conversations + messages (history, read receipts).
 *
 * Realtime (send/typing/react/presence) lives in the realtime-gateway; these
 * are the HTTP read/bootstrap endpoints the client uses alongside the socket.
 *
 * NOTE (shared-DB phase): reads `users` (block lists / profile) and
 * `connectionrequests` (accepted-connection boundary) — cross-context reads to
 * be replaced by profile/connection service APIs (or events) in M6.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import Conversation from '../models/conversation.js';
import Message from '../models/message.js';
import User from '../models/user.js';
import { canUsersChat } from '../lib/chatAuthorization.js';

const router = Router();

const sortedPair = (a, b) =>
  [a.toString(), b.toString()].sort((x, y) => x.localeCompare(y));

// GET /chat/conversations — list logged-in user's conversations, most recent first.
router.get('/conversations', userAuth, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const myBlockedIds = new Set(req.user.blockedUsers.map((id) => id.toString()));

    const usersWhoBlockedMe = await User.find({ blockedUsers: loggedInUserId }).select('_id');
    usersWhoBlockedMe.forEach((u) => myBlockedIds.add(u._id.toString()));

    const conversations = await Conversation.find({ participants: loggedInUserId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'firstName lastName photoUrl');

    const data = conversations
      .map((conversation) => {
        const otherUser = conversation.participants.find(
          (participant) => !participant._id.equals(loggedInUserId),
        );
        return {
          _id: conversation._id,
          otherUser,
          lastMessageAt: conversation.lastMessageAt,
          lastReadAt: conversation.lastReadBy?.get(loggedInUserId.toString()) || null,
          otherUserLastReadAt: conversation.lastReadBy?.get(otherUser._id.toString()) || null,
          updatedAt: conversation.updatedAt,
        };
      })
      .filter((item) => !myBlockedIds.has(item.otherUser._id.toString()));

    res.status(200).json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /chat/conversations/:userId — get-or-create a conversation with an accepted, non-blocked connection
router.post('/conversations/:userId', userAuth, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const authorization = await canUsersChat(loggedInUserId, userId);
    if (!authorization.allowed) return res.status(403).json({ error: authorization.reason });

    const participants = sortedPair(loggedInUserId, userId);

    let conversation = await Conversation.findOne({ participants });
    if (!conversation) {
      conversation = new Conversation({ participants });
      await conversation.save();
    }
    await conversation.populate('participants', 'firstName lastName photoUrl');

    res.status(200).json({ data: conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /chat/conversations/:conversationId/messages — paginated history
router.get('/conversations/:conversationId/messages', userAuth, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { conversationId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

    if (!mongoose.Types.ObjectId.isValid(conversationId))
      return res.status(400).json({ error: 'Invalid conversation id' });

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: loggedInUserId,
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const otherUserId = conversation.participants.find(
      (participantId) => !participantId.equals(loggedInUserId),
    );
    const authorization = await canUsersChat(loggedInUserId, otherUserId);
    if (!authorization.allowed) return res.status(403).json({ error: authorization.reason });

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      count: messages.length,
      page,
      data: messages.reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /chat/conversations/:conversationId/read — mark conversation as read
router.post('/conversations/:conversationId/read', userAuth, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId))
      return res.status(400).json({ error: 'Invalid conversation id' });

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: loggedInUserId,
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    if (!conversation.lastReadBy) conversation.lastReadBy = new Map();
    conversation.lastReadBy.set(loggedInUserId.toString(), new Date());
    await conversation.save();

    res.status(200).json({ message: 'Conversation marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
