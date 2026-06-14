import mongoose from 'mongoose';
import getGroupMessageModel from '../models/groupMessage.js';
import getGroupModel from '../models/group.js';
import { canUserAccessGroup } from '../lib/groupAuthorization.js';

// Ported verbatim from the monolith (backend/src/sockets/groupChatHandlers.js).
const ROOM = (groupId) => `group:${groupId}`;

const ALLOWED_TYPES = ['text', 'snippet'];

const authorizeGroupAccess = async (socket, groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    socket.emit('group_error', { event: 'group_access', message: 'Invalid group id' });
    return null;
  }

  const { allowed, role, reason } = await canUserAccessGroup(socket.user._id, groupId);
  if (!allowed) {
    socket.emit('group_error', { event: 'group_access', message: reason });
    return null;
  }

  const group = await getGroupModel().findOne({ _id: groupId, deletedAt: null });
  return { group, role };
};

export const registerGroupChatHandlers = (io, socket) => {
  socket.on('join_group', async ({ groupId } = {}, ack) => {
    try {
      const access = await authorizeGroupAccess(socket, groupId);
      if (!access) return;

      socket.join(ROOM(groupId));
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      socket.emit('group_error', { event: 'join_group', message: err.message });
    }
  });

  socket.on('send_group_message', async ({ groupId, type = 'text', body, language = null } = {}, ack) => {
    try {
      if (!ALLOWED_TYPES.includes(type)) {
        socket.emit('group_error', { event: 'send_group_message', message: 'Invalid message type' });
        return;
      }
      if (!body || !body.trim()) {
        socket.emit('group_error', { event: 'send_group_message', message: 'Message body is required' });
        return;
      }

      const access = await authorizeGroupAccess(socket, groupId);
      if (!access) return;
      const { group } = access;

      const message = await getGroupMessageModel().create({
        groupId,
        senderId: socket.user._id,
        type,
        body: body.trim(),
        language: type === 'snippet' ? language : null,
      });

      group.updatedAt = message.createdAt;
      group.save().catch(() => {});

      io.to(ROOM(groupId)).emit('group_message_received', {
        _id: message._id.toString(),
        groupId: message.groupId.toString(),
        senderId: message.senderId.toString(),
        type: message.type,
        body: message.body,
        language: message.language,
        createdAt: message.createdAt,
      });

      if (typeof ack === 'function') ack({ ok: true, messageId: message._id });
    } catch (err) {
      socket.emit('group_error', { event: 'send_group_message', message: err.message });
    }
  });

  socket.on('group_typing', async ({ groupId, isTyping } = {}) => {
    try {
      const access = await authorizeGroupAccess(socket, groupId);
      if (!access) return;

      socket.to(ROOM(groupId)).emit('group_typing_update', {
        groupId,
        userId: socket.user._id.toString(),
        isTyping: Boolean(isTyping),
      });
    } catch (err) {
      socket.emit('group_error', { event: 'group_typing', message: err.message });
    }
  });

  socket.on('leave_group', async ({ groupId } = {}, ack) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        socket.emit('group_error', { event: 'leave_group', message: 'Invalid group id' });
        return;
      }

      socket.leave(ROOM(groupId));
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      socket.emit('group_error', { event: 'leave_group', message: err.message });
    }
  });
};

export default registerGroupChatHandlers;
