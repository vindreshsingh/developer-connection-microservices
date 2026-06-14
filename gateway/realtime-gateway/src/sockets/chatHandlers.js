import mongoose from 'mongoose';
import getConversationModel from '../models/conversation.js';
import getMessageModel from '../models/message.js';
import { canUsersChat } from '../lib/chatAuthorization.js';

// Ported verbatim from the monolith (backend/src/sockets/chatHandlers.js).
const ROOM = (conversationId) => `conversation:${conversationId}`;

const ALLOWED_TYPES = ['text', 'snippet'];

const authorizeConversationAccess = async (socket, conversationId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    socket.emit('chat_error', { event: 'conversation_access', message: 'Invalid conversation id' });
    return null;
  }

  const conversation = await getConversationModel().findOne({
    _id: conversationId,
    participants: socket.user._id,
  });
  if (!conversation) {
    socket.emit('chat_error', { event: 'conversation_access', message: 'Conversation not found' });
    return null;
  }

  const otherUserId = conversation.participants.find(
    (participantId) => !participantId.equals(socket.user._id),
  );

  const authorization = await canUsersChat(socket.user._id, otherUserId);
  if (!authorization.allowed) {
    socket.emit('chat_error', { event: 'conversation_access', message: authorization.reason });
    return null;
  }

  return { conversation, otherUserId };
};

export const registerChatHandlers = (io, socket) => {
  socket.on('join_conversation', async ({ conversationId } = {}, ack) => {
    try {
      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;

      socket.join(ROOM(conversationId));
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      socket.emit('chat_error', { event: 'join_conversation', message: err.message });
    }
  });

  socket.on('mark_read', async ({ conversationId } = {}) => {
    try {
      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;
      const { conversation } = access;

      if (!conversation.lastReadBy) conversation.lastReadBy = new Map();
      const readAt = new Date();
      conversation.lastReadBy.set(socket.user._id.toString(), readAt);
      await conversation.save();

      socket.to(ROOM(conversationId)).emit('conversation_read', {
        conversationId,
        userId: socket.user._id.toString(),
        readAt,
      });
    } catch (err) {
      socket.emit('chat_error', { event: 'mark_read', message: err.message });
    }
  });

  socket.on('react', async ({ conversationId, messageId, emoji } = {}) => {
    try {
      if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0 || emoji.length > 8) {
        socket.emit('chat_error', { event: 'react', message: 'Invalid emoji' });
        return;
      }

      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        socket.emit('chat_error', { event: 'react', message: 'Invalid message id' });
        return;
      }

      const message = await getMessageModel().findOne({ _id: messageId, conversationId });
      if (!message) {
        socket.emit('chat_error', { event: 'react', message: 'Message not found' });
        return;
      }

      const userId = socket.user._id;
      const existingIdx = message.reactions.findIndex((r) => r.userId.equals(userId));

      if (existingIdx !== -1) {
        if (message.reactions[existingIdx].emoji === emoji) {
          message.reactions.splice(existingIdx, 1);
        } else {
          message.reactions[existingIdx].emoji = emoji;
        }
      } else {
        message.reactions.push({ userId, emoji });
      }
      await message.save();

      io.to(ROOM(conversationId)).emit('reaction_update', {
        messageId: message._id.toString(),
        conversationId,
        reactions: message.reactions.map((r) => ({
          userId: r.userId.toString(),
          emoji: r.emoji,
        })),
      });
    } catch (err) {
      socket.emit('chat_error', { event: 'react', message: err.message });
    }
  });

  socket.on('typing', async ({ conversationId, isTyping } = {}) => {
    try {
      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;
      const { otherUserId } = access;

      socket.to(ROOM(conversationId)).emit('typing_update', {
        conversationId,
        userId: socket.user._id.toString(),
        isTyping: Boolean(isTyping),
      });

      void otherUserId;
    } catch (err) {
      socket.emit('chat_error', { event: 'typing', message: err.message });
    }
  });

  socket.on('send_message', async ({ conversationId, type = 'text', body, language = null } = {}, ack) => {
    try {
      if (!ALLOWED_TYPES.includes(type)) {
        socket.emit('chat_error', { event: 'send_message', message: 'Invalid message type' });
        return;
      }
      if (!body || !body.trim()) {
        socket.emit('chat_error', { event: 'send_message', message: 'Message body is required' });
        return;
      }

      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;
      const { conversation } = access;

      const message = await getMessageModel().create({
        conversationId,
        senderId: socket.user._id,
        type,
        body: body.trim(),
        language: type === 'snippet' ? language : null,
      });

      conversation.lastMessageAt = message.createdAt;
      await conversation.save();

      io.to(ROOM(conversationId)).emit('message_received', {
        _id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        senderId: message.senderId.toString(),
        type: message.type,
        body: message.body,
        language: message.language,
        reactions: message.reactions,
        createdAt: message.createdAt,
      });

      if (typeof ack === 'function') ack({ ok: true, messageId: message._id });
    } catch (err) {
      socket.emit('chat_error', { event: 'send_message', message: err.message });
    }
  });
};

export default registerChatHandlers;
