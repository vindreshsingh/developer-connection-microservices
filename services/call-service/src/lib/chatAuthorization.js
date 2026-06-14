import ConnectionRequest from '../models/connectionRequest.js';
import { getBlockContext, getProfile } from '@dc/service-clients';

export const canUsersChat = async (userAId, userBId) => {
  if (userAId.toString() === userBId.toString()) {
    return { allowed: false, reason: 'Cannot chat with yourself' };
  }

  const [ctxA, ctxB, profileB, connection] = await Promise.all([
    getBlockContext(userAId),
    getBlockContext(userBId),
    getProfile(userBId),
    ConnectionRequest.findOne({
      status: 'accepted',
      $or: [
        { fromUserId: userAId, toUserId: userBId },
        { fromUserId: userBId, toUserId: userAId },
      ],
    }),
  ]);

  if (!profileB) return { allowed: false, reason: 'User not found' };
  if (!connection) return { allowed: false, reason: 'You can only message accepted connections' };

  const aId = userAId.toString();
  const bId = userBId.toString();
  if (ctxA.blockedUsers.includes(bId) || ctxB.blockedUsers.includes(aId)) {
    return { allowed: false, reason: 'You cannot message this user' };
  }

  return { allowed: true };
};
