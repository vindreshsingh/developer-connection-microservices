import Conversation from '../models/conversation.js';
import Message from '../models/message.js';
import GroupMessage from '../models/groupMessage.js';

// Ported verbatim from the monolith (backend/src/utils/callSummaryUtils.js).
// Idempotent (upsert by callSummary.callId) post-call system message, emitted
// into the chat/group thread. `io` is the realtime-gateway's Socket.IO server.
export const createCallSummaryMessage = async (io, call) => {
  if (call.status !== 'ended') return;
  if (call.type === '1:1') {
    await _create1on1Summary(io, call);
  } else if (call.type === 'group') {
    await _createGroupSummary(io, call);
  }
};

async function _create1on1Summary(io, call) {
  const participantIds = call.participants.map((p) => p.userId);
  const conv = await Conversation.findOne({ participants: { $all: participantIds } });
  if (!conv) return;

  const result = await Message.findOneAndUpdate(
    { 'callSummary.callId': call._id },
    {
      $setOnInsert: {
        conversationId: conv._id,
        senderId: call.initiatorId,
        type: 'call_summary',
        callSummary: { callId: call._id, duration: call.duration ?? 0, status: 'ended', callType: '1:1' },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (io && result) {
    io.to(`conv:${conv._id}`).emit('message_received', {
      message: result.toObject(),
      conversationId: conv._id.toString(),
    });
  }
}

async function _createGroupSummary(io, call) {
  const result = await GroupMessage.findOneAndUpdate(
    { 'callSummary.callId': call._id },
    {
      $setOnInsert: {
        groupId: call.groupId,
        senderId: call.initiatorId,
        type: 'call_summary',
        callSummary: { callId: call._id, duration: call.duration ?? 0, status: 'ended', callType: 'group' },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (io && result) {
    io.to(`group:${call.groupId}`).emit('group_message_received', {
      message: result.toObject(),
      groupId: call.groupId.toString(),
    });
  }
}
