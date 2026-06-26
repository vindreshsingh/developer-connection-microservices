import { config } from '@dc/config';
import { applyPremiumAllowlist } from '@dc/auth';
import { validateSession } from '@dc/service-clients';
import Profile from '../models/profile.js';

const profileAuth = async (req, res, next) => {
  const userId = req.headers[config.internalAuthHeader];
  if (!userId) return res.status(401).json({ error: 'Please login to continue' });

  try {
    const fwdTokenVersion = req.headers[config.internalTokenVersionHeader];
    const valid = await validateSession(
      userId,
      fwdTokenVersion !== undefined ? Number(fwdTokenVersion) : undefined,
    );
    if (!valid) return res.status(401).json({ error: 'Session expired. Please login again' });

    const profile = await Profile.findById(userId);
    if (!profile) return res.status(401).json({ error: 'User not found' });

    req.user = profile;
    req.userId = String(profile._id);
    applyPremiumAllowlist(req);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default profileAuth;
