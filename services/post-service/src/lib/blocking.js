import User from '../models/user.js';

// Ported from the monolith (backend/src/utils/blocking.js).
export const getExcludedUserIds = async (user) => {
  const blockedMe = await User.find({ blockedUsers: user._id }).select('_id');
  return [...user.blockedUsers, ...blockedMe.map((u) => u._id)];
};
