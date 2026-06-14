import { getBlockContext } from '@dc/service-clients';

export const getExcludedUserIds = async (user) => {
  const ctx = await getBlockContext(user._id);
  return [...ctx.blockedUsers, ...ctx.blockedBy];
};
