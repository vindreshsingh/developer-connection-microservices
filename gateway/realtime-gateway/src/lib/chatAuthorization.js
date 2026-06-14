import ConnectionRequest from '../models/connectionRequest.js';
import User from '../models/user.js';

// Ported verbatim from the monolith (backend/src/utils/chatAuthorization.js).
// "Can these two users chat right now?" — accepted connection AND no block in
// either direction. Re-checked on every socket event.
export const canUsersChat = async (userAId, userBId) => {
  if (userAId.toString() === userBId.toString()) {
    return { allowed: false, reason: 'Cannot chat with yourself' };
  }

  const [userA, userB, connection] = await Promise.all([
    User.findById(userAId).select('blockedUsers'),
    User.findById(userBId).select('blockedUsers'),
    ConnectionRequest.findOne({
      status: 'accepted',
      $or: [
        { fromUserId: userAId, toUserId: userBId },
        { fromUserId: userBId, toUserId: userAId },
      ],
    }),
  ]);

  if (!userA || !userB) return { allowed: false, reason: 'User not found' };
  if (!connection) return { allowed: false, reason: 'You can only message accepted connections' };

  const aBlockedB = userA.blockedUsers.some((id) => id.equals(userBId));
  const bBlockedA = userB.blockedUsers.some((id) => id.equals(userAId));
  if (aBlockedB || bBlockedA) return { allowed: false, reason: 'You cannot message this user' };

  return { allowed: true };
};
