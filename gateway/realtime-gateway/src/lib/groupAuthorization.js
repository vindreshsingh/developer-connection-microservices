import getGroupModel from '../models/group.js';

// Ported verbatim from the monolith (backend/src/utils/groupAuthorization.js).
export const canUserAccessGroup = async (userId, groupId) => {
  const group = await getGroupModel().findOne({ _id: groupId, deletedAt: null });
  if (!group) return { allowed: false, reason: 'Group not found or has been deleted.' };

  const member = group.members.find((m) => m.userId.equals(userId));
  if (!member) return { allowed: false, reason: 'You are not a member of this group.' };

  return { allowed: true, role: member.role };
};
