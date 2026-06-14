import { emitToRoom } from '@dc/realtime';
import Conversation from '../models/conversation.js';
import Message from '../models/message.js';
import GroupMessage from '../models/groupMessage.js';

// Ported from the monolith (backend/src/utils/callSummaryUtils.js). Instead of a
// local `io`, fan-out goes through @dc/realtime's redis emitter so the message
// reaches sockets held by the realtime-gateway (no-op without Redis).
export const createCallSummaryMessage = async (call) => {
  if (call.status !== 'ended') return;
  if (call.type === '1:1') {
    await _create1on1Summary(call);
  } else if (call.type === 'group') {
    await _createGroupSummary(call);
  }
};

async function _create1on1Summary(call) {
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

  if (result) {
    emitToRoom(`conv:${conv._id}`, 'message_received', {
      message: result.toObject(),
      conversationId: conv._id.toString(),
    });
  }
}

async function _createGroupSummary(call) {
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

  if (result) {
    emitToRoom(`group:${call.groupId}`, 'group_message_received', {
      message: result.toObject(),
      groupId: call.groupId.toString(),
    });
  }
}
