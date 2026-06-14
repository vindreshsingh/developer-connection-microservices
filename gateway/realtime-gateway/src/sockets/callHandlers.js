import mongoose from 'mongoose';
import CallSession from '../models/callSession.js';
import { createCallSummaryMessage } from '../lib/callSummaryUtils.js';

// Ported verbatim from the monolith (backend/src/sockets/callHandlers.js).
// Dumb relay for SDP/ICE; persists status transitions (ended / declined).
const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const authorizeCallAccess = async (socket, callId, { allowTerminated = false } = {}) => {
  if (!callId || !validObjectId(callId)) {
    socket.emit('call_error', { event: 'call_access', message: 'Invalid call ID.' });
    return null;
  }

  const call = await CallSession.findById(callId);
  if (!call) {
    socket.emit('call_error', { event: 'call_access', message: 'Call not found.' });
    return null;
  }

  if (!allowTerminated && ['ended', 'declined', 'missed'].includes(call.status)) {
    return null;
  }

  if (!call.isParticipant(socket.user._id)) {
    socket.emit('call_error', { event: 'call_access', message: 'You are not a participant in this call.' });
    return null;
  }

  return { call };
};

const getOtherParticipantIds = (call, myUserId) =>
  call.participants.filter((p) => !p.userId.equals(myUserId)).map((p) => p.userId.toString());

export const registerCallHandlers = (io, socket) => {
  socket.on('call_offer', async ({ callId, sdp } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (!sdp) {
        socket.emit('call_error', { event: 'call_offer', message: 'SDP is required.' });
        return;
      }

      const otherIds = getOtherParticipantIds(call, socket.user._id);
      otherIds.forEach((id) => {
        io.to(`user:${id}`).emit('call_offer', {
          callId: callId.toString(),
          callerId: socket.user._id.toString(),
          sdp,
        });
      });
    } catch (err) {
      socket.emit('call_error', { event: 'call_offer', message: err.message });
    }
  });

  socket.on('call_answer', async ({ callId, sdp } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (!sdp) {
        socket.emit('call_error', { event: 'call_answer', message: 'SDP is required.' });
        return;
      }

      io.to(`user:${call.initiatorId}`).emit('call_answer', {
        callId: callId.toString(),
        calleeId: socket.user._id.toString(),
        sdp,
      });
    } catch (err) {
      socket.emit('call_error', { event: 'call_answer', message: err.message });
    }
  });

  socket.on('ice_candidate', async ({ callId, candidate } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (candidate === undefined) {
        socket.emit('call_error', { event: 'ice_candidate', message: 'Candidate is required.' });
        return;
      }

      const otherIds = getOtherParticipantIds(call, socket.user._id);
      otherIds.forEach((id) => {
        io.to(`user:${id}`).emit('ice_candidate', {
          callId: callId.toString(),
          senderId: socket.user._id.toString(),
          candidate,
        });
      });
    } catch (err) {
      socket.emit('call_error', { event: 'ice_candidate', message: err.message });
    }
  });

  socket.on('call_ended', async ({ callId } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId, { allowTerminated: false });
      if (!access) return;
      const { call } = access;

      const now = new Date();
      call.status = 'ended';
      call.endedAt = now;
      call.duration = call.startedAt ? Math.round((now - call.startedAt) / 1000) : 0;

      const participant = call.participants.find((p) => p.userId.equals(socket.user._id));
      if (participant) participant.leftAt = now;

      await call.save();

      call.participants.forEach((p) => {
        io.to(`user:${p.userId}`).emit('call_ended', {
          callId: callId.toString(),
          endedBy: socket.user._id.toString(),
          duration: call.duration,
        });
      });

      createCallSummaryMessage(io, call).catch(() => {});
    } catch (err) {
      socket.emit('call_error', { event: 'call_ended', message: err.message });
    }
  });

  socket.on('call_rejected', async ({ callId } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (call.status !== 'ringing') return;

      call.status = 'declined';
      call.endedAt = new Date();
      await call.save();

      io.to(`user:${call.initiatorId}`).emit('call_rejected', {
        callId: callId.toString(),
        rejectedBy: socket.user._id.toString(),
      });
    } catch (err) {
      socket.emit('call_error', { event: 'call_rejected', message: err.message });
    }
  });
};

export default registerCallHandlers;
