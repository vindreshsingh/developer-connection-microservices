import { config } from '@dc/config';
import { applyPremiumAllowlist } from '@dc/auth';
import { validateSession, getProfile } from '@dc/service-clients';
import User from '../models/user.js';

// Profile from profile-service; blockedUsers from connection DB.
export default async function connectionAuth(req, res, next) {
  const userId = req.headers[config.internalAuthHeader];
  if (!userId) return res.status(401).json({ error: 'Please login to continue' });

  try {
    const fwdTokenVersion = req.headers[config.internalTokenVersionHeader];
    const valid = await validateSession(
      userId,
      fwdTokenVersion !== undefined ? Number(fwdTokenVersion) : undefined,
    );
    if (!valid) return res.status(401).json({ error: 'Session expired. Please login again' });

    const profile = await getProfile(userId);
    if (!profile) return res.status(401).json({ error: 'User not found' });

    let connUser = await User.findById(userId);
    if (!connUser) connUser = await User.create({ _id: userId, blockedUsers: [] });

    req.user = { ...profile, _id: profile._id || userId, blockedUsers: connUser.blockedUsers };
    req.userId = String(userId);
    applyPremiumAllowlist(req);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
