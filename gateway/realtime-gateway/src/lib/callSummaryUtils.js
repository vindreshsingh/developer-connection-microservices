import getConversationModel from '../models/conversation.js';
import getMessageModel from '../models/message.js';
import getGroupMessageModel from '../models/groupMessage.js';

const CONVERSATION_ROOM = (conversationId) => `conversation:${conversationId}`;

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
  const conv = await getConversationModel().findOne({ participants: { $all: participantIds } });
  if (!conv) return;

  const result = await getMessageModel().findOneAndUpdate(
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
    io.to(CONVERSATION_ROOM(conv._id)).emit('message_received', {
      _id: result._id.toString(),
      conversationId: conv._id.toString(),
      senderId: result.senderId.toString(),
      type: result.type,
      body: result.body,
      language: result.language,
      reactions: result.reactions,
      callSummary: result.callSummary,
      createdAt: result.createdAt,
    });
  }
}

async function _createGroupSummary(io, call) {
  const result = await getGroupMessageModel().findOneAndUpdate(
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
      _id: result._id.toString(),
      groupId: result.groupId.toString(),
      senderId: result.senderId.toString(),
      type: result.type,
      body: result.body,
      language: result.language,
      createdAt: result.createdAt,
    });
  }
}
