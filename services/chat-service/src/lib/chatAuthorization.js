import { getBlockContext, getProfile, hasAcceptedConnection } from '@dc/service-clients';

export const canUsersChat = async (userAId, userBId) => {
  if (userAId.toString() === userBId.toString()) {
    return { allowed: false, reason: 'Cannot chat with yourself' };
  }

  const [ctxA, ctxB, profileB, accepted] = await Promise.all([
    getBlockContext(userAId),
    getBlockContext(userBId),
    getProfile(userBId),
    hasAcceptedConnection(userAId, userBId),
  ]);

  if (!profileB) return { allowed: false, reason: 'User not found' };
  if (!accepted) return { allowed: false, reason: 'You can only message accepted connections' };

  const aId = userAId.toString();
  const bId = userBId.toString();
  if (ctxA.blockedUsers.includes(bId) || ctxB.blockedUsers.includes(aId)) {
    return { allowed: false, reason: 'You cannot message this user' };
  }

  return { allowed: true };
};
