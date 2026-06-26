/**
 * Calls REST API — ported from the monolith (backend/src/routes/calls.js).
 * Mounted at /calls. Owns CallSession lifecycle (1:1 + group) and LiveKit tokens.
 *
 * Socket signaling (offer/answer/ICE, group join/leave/end) lives in the
 * realtime-gateway. REST-side realtime notifications (call_incoming,
 * group_call_started, call_rejected, call_ended, call_summary) are pushed to the
 * gateway's rooms via @dc/realtime (Redis emitter; no-op without Redis).
 *
 * NOTE (shared-DB phase): reads `users`/`connectionrequests`/`groups`/`plans`
 * and writes call_summary into chat's `messages`/`groupmessages` — cross-context
 * reads/writes to be decoupled via service APIs (or events) in M6.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import { emitToRoom } from '@dc/realtime';
import userAuth from '../middlewares/auth.js';
import CallSession from '../models/callSession.js';
import Plan from '../models/plan.js';
import { canUsersChat } from '../lib/chatAuthorization.js';
import { canUserAccessGroup } from '../lib/groupAuthorization.js';
import { generateRoomToken } from '../lib/liveKit.js';
import { createCallSummaryMessage } from '../lib/callSummaryUtils.js';

const router = Router();
const PAGE_SIZE = 20;

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /calls — initiate a call
router.post('/', userAuth, async (req, res) => {
  try {
    const { type, targetUserId, groupId } = req.body;
    const callerId = req.user._id;

    if (!['1:1', 'group'].includes(type)) {
      return res.status(400).json({ error: 'type must be "1:1" or "group".' });
    }

    if (type === '1:1') {
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required for 1:1 calls.' });
      }
      if (!validObjectId(targetUserId)) {
        return res.status(400).json({ error: 'Invalid targetUserId.' });
      }
      if (String(callerId) === String(targetUserId)) {
        return res.status(400).json({ error: 'You cannot call yourself.' });
      }

      const auth = await canUsersChat(callerId, targetUserId);
      if (!auth.allowed) {
        return res.status(403).json({ error: auth.reason });
      }

      const existing = await CallSession.findOne({
        type: '1:1',
        status: { $in: ['ringing', 'active'] },
        'participants.userId': targetUserId,
        initiatorId: callerId,
      });
      if (existing) {
        return res.status(409).json({ error: 'A call is already in progress with this user.', callId: existing._id });
      }

      const callSession = await CallSession.create({
        type: '1:1',
        initiatorId: callerId,
        participants: [
          { userId: callerId, joinedAt: new Date() },
          { userId: targetUserId, joinedAt: null },
        ],
      });

      const callerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
      emitToRoom(`user:${targetUserId}`, 'call_incoming', {
        callId: callSession._id,
        callerId: callerId.toString(),
        callerName,
        callerPhotoUrl: req.user.photoUrl ?? null,
        type: '1:1',
      });

      return res.status(201).json({ message: 'Call initiated.', callId: callSession._id });
    }

    if (!groupId || !validObjectId(groupId)) {
      return res.status(400).json({ error: 'groupId is required for group calls.' });
    }

    const groupAuth = await canUserAccessGroup(callerId, groupId);
    if (!groupAuth.allowed) {
      return res.status(403).json({ error: groupAuth.reason });
    }

    const existingGroup = await CallSession.findOne({
      type: 'group',
      groupId,
      status: { $in: ['ringing', 'active'] },
    });
    if (existingGroup) {
      return res.status(409).json({ error: 'A group call is already active.', callId: existingGroup._id });
    }

    const callSession = await CallSession.create({
      type: 'group',
      initiatorId: callerId,
      groupId,
      participants: [{ userId: callerId, joinedAt: new Date() }],
      status: 'active',
      startedAt: new Date(),
      isPriority: req.user.isPremium,
    });

    const callerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
    emitToRoom(`group:${groupId}`, 'group_call_started', {
      callId: callSession._id,
      groupId,
      startedBy: callerName,
    });

    return res.status(201).json({ message: 'Group call started.', callId: callSession._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /calls — call history
router.get('/', userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const userId = req.user._id;

    const filter = {
      $or: [{ initiatorId: userId }, { 'participants.userId': userId }],
    };

    const total = await CallSession.countDocuments(filter);
    const calls = await CallSession.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('participants.userId', 'firstName lastName photoUrl')
      .populate('initiatorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: calls,
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

// POST /calls/group-token — issue LiveKit room token
// Defined before /:callId GET; POST has no /:callId collision (only suffixed POSTs).
router.post('/group-token', userAuth, async (req, res) => {
  try {
    const { callId } = req.body;

    if (!callId || !validObjectId(callId)) {
      return res.status(400).json({ error: 'callId is required and must be a valid ID.' });
    }

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (call.type !== 'group') {
      return res.status(400).json({ error: 'Tokens are only issued for group calls.' });
    }
    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (!['active', 'ringing'].includes(call.status)) {
      return res.status(400).json({ error: `Cannot join a call with status "${call.status}".` });
    }

    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
    const token = await generateRoomToken({
      callId: callId.toString(),
      userId: req.user._id.toString(),
      displayName: displayName || undefined,
    });

    const planKey = call.isPriority ? 'premium' : 'free';
    const plan = await Plan.findOne({ key: planKey });
    const maxParticipants = plan?.features?.groupCallParticipantCap ?? 8;

    res.status(200).json({ token, room: `call:${callId}`, maxParticipants });
  } catch (err) {
    if (err.message.includes('LIVEKIT_API_KEY')) {
      return res.status(503).json({ error: 'Video service is not configured.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /calls/:callId — call metadata
router.get('/:callId', userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId)
      .populate('participants.userId', 'firstName lastName photoUrl')
      .populate('initiatorId', 'firstName lastName photoUrl');

    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }

    res.status(200).json({ call });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /calls/:callId/accept
router.post('/:callId/accept', userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (call.status !== 'ringing') {
      return res.status(400).json({ error: `Cannot accept a call with status "${call.status}".` });
    }

    call.status = 'active';
    call.startedAt = new Date();

    const participant = call.participants.find((p) => p.userId.equals(req.user._id));
    if (participant) participant.joinedAt = new Date();

    await call.save();
    res.status(200).json({ message: 'Call accepted.', call });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /calls/:callId/decline
router.post('/:callId/decline', userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (call.status !== 'ringing') {
      return res.status(400).json({ error: `Cannot decline a call with status "${call.status}".` });
    }

    call.status = 'declined';
    call.endedAt = new Date();
    await call.save();

    emitToRoom(`user:${call.initiatorId}`, 'call_rejected', { callId: call._id });

    res.status(200).json({ message: 'Call declined.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /calls/:callId/end
router.post('/:callId/end', userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (['ended', 'declined', 'missed'].includes(call.status)) {
      return res.status(400).json({ error: `Call is already ${call.status}.` });
    }

    const now = new Date();
    call.status = 'ended';
    call.endedAt = now;
    call.duration = call.startedAt ? Math.round((now - call.startedAt) / 1000) : 0;

    const participant = call.participants.find((p) => p.userId.equals(req.user._id));
    if (participant) participant.leftAt = now;

    await call.save();

    call.participants.forEach((p) => {
      emitToRoom(`user:${p.userId}`, 'call_ended', {
        callId: call._id,
        endedBy: req.user._id.toString(),
        duration: call.duration,
      });
    });

    createCallSummaryMessage(call).catch(() => {});

    res.status(200).json({ message: 'Call ended.', duration: call.duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
