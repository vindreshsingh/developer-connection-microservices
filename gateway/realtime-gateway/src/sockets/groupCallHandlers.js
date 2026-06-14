import mongoose from 'mongoose';
import CallSession from '../models/callSession.js';
import { canUserAccessGroup } from '../lib/groupAuthorization.js';
import { createCallSummaryMessage } from '../lib/callSummaryUtils.js';

// Ported verbatim from the monolith (backend/src/sockets/groupCallHandlers.js).
// LiveKit SFU model — Socket.IO only tracks participants and notifies members.
const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const loadActiveGroupCall = async (socket, callId) => {
  if (!callId || !validObjectId(callId)) {
    socket.emit('call_error', { event: 'group_call', message: 'Invalid call ID.' });
    return null;
  }

  const call = await CallSession.findById(callId);
  if (!call) {
    socket.emit('call_error', { event: 'group_call', message: 'Call not found.' });
    return null;
  }
  if (call.type !== 'group') {
    socket.emit('call_error', { event: 'group_call', message: 'Not a group call.' });
    return null;
  }
  if (!['active', 'ringing'].includes(call.status)) {
    socket.emit('call_error', {
      event: 'group_call',
      message: `Cannot interact with a call that has status "${call.status}".`,
    });
    return null;
  }

  return { call };
};

const persistAndBroadcastEnd = async (io, call, endedById) => {
  const now = new Date();
  call.status = 'ended';
  call.endedAt = now;
  call.duration = call.startedAt ? Math.round((now - call.startedAt) / 1000) : 0;
  await call.save();

  const payload = {
    callId: call._id.toString(),
    groupId: call.groupId.toString(),
    endedBy: endedById.toString(),
    duration: call.duration,
  };

  io.to(`group:${call.groupId}`).emit('group_call_ended', payload);

  call.participants.forEach((p) => {
    io.to(`user:${p.userId}`).emit('group_call_ended', payload);
  });

  createCallSummaryMessage(io, call).catch(() => {});

  return call;
};

export const registerGroupCallHandlers = (io, socket) => {
  socket.on('group_call_join', async ({ callId } = {}) => {
    try {
      const result = await loadActiveGroupCall(socket, callId);
      if (!result) return;
      const { call } = result;

      const auth = await canUserAccessGroup(socket.user._id, call.groupId.toString());
      if (!auth.allowed) {
        socket.emit('call_error', { event: 'group_call_join', message: auth.reason });
        return;
      }

      const existing = call.participants.find((p) => p.userId.equals(socket.user._id));
      if (!existing) {
        call.participants.push({ userId: socket.user._id, joinedAt: new Date() });
      } else if (!existing.joinedAt) {
        existing.joinedAt = new Date();
      }
      await call.save();

      const joiningUserId = socket.user._id.toString();

      call.participants.forEach((p) => {
        const id = p.userId.toString();
        if (id !== joiningUserId) {
          io.to(`user:${id}`).emit('group_participant_joined', {
            callId: call._id.toString(),
            groupId: call.groupId.toString(),
            userId: joiningUserId,
          });
        }
      });

      socket.emit('group_call_joined', {
        callId: call._id.toString(),
        groupId: call.groupId.toString(),
        participants: call.participants.map((p) => ({
          userId: p.userId.toString(),
          joinedAt: p.joinedAt,
        })),
      });
    } catch (err) {
      socket.emit('call_error', { event: 'group_call_join', message: err.message });
    }
  });

  socket.on('group_call_leave', async ({ callId } = {}) => {
    try {
      const result = await loadActiveGroupCall(socket, callId);
      if (!result) return;
      const { call } = result;

      if (!call.isParticipant(socket.user._id)) {
        socket.emit('call_error', {
          event: 'group_call_leave',
          message: 'You are not a participant in this call.',
        });
        return;
      }

      const now = new Date();
      const leavingUserId = socket.user._id.toString();

      const participant = call.participants.find((p) => p.userId.equals(socket.user._id));
      if (participant && !participant.leftAt) {
        participant.leftAt = now;
      }
      await call.save();

      const remaining = call.participants.filter((p) => !p.leftAt);

      if (remaining.length === 0) {
        await persistAndBroadcastEnd(io, call, socket.user._id);
      } else {
        remaining.forEach((p) => {
          io.to(`user:${p.userId}`).emit('group_participant_left', {
            callId: call._id.toString(),
            groupId: call.groupId.toString(),
            userId: leavingUserId,
          });
        });
      }
    } catch (err) {
      socket.emit('call_error', { event: 'group_call_leave', message: err.message });
    }
  });

  socket.on('group_call_end', async ({ callId } = {}) => {
    try {
      const result = await loadActiveGroupCall(socket, callId);
      if (!result) return;
      const { call } = result;

      if (!call.isParticipant(socket.user._id)) {
        socket.emit('call_error', {
          event: 'group_call_end',
          message: 'You are not a participant in this call.',
        });
        return;
      }

      await persistAndBroadcastEnd(io, call, socket.user._id);
    } catch (err) {
      socket.emit('call_error', { event: 'group_call_end', message: err.message });
    }
  });
};

export default registerGroupCallHandlers;
