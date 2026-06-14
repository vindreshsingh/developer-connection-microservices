import jwt from 'jsonwebtoken';
import { config } from '@dc/config';

// Verify a JWT (used by the gateway at the edge).
export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

// Downstream services trust the gateway's signed internal header instead of
// re-validating the cookie. The gateway sets it after verifyToken() succeeds.
export const requireUser = (req, _res, next) => {
  const userId = req.headers[config.internalAuthHeader];
  if (!userId) {
    const e = new Error('Missing internal user header');
    e.statusCode = 401;
    return next(e);
  }
  req.userId = userId;
  next();
};

/**
 * Factory for services that need the full user document on req.user (parity
 * with the monolith's userAuth) — premium gating, profile context, etc.
 *
 * In the shared-DB phase these services read the monolith's `users` collection
 * via their own (lean) User model. We re-check `tokenVersion` here using the
 * value the gateway forwarded (x-internal-token-version) so password-reset /
 * logout-everywhere revocation still works end-to-end — the gateway only does
 * jwt.verify and cannot know the current tokenVersion on its own.
 *
 * Error shapes match the monolith's userAuth for response parity.
 */
export const createUserAuth = (UserModel) => async (req, res, next) => {
  const userId = req.headers[config.internalAuthHeader];
  if (!userId) return res.status(401).json({ error: 'Please login to continue' });
  try {
    const user = await UserModel.findById(userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });

    const fwdTokenVersion = req.headers[config.internalTokenVersionHeader];
    if (fwdTokenVersion !== undefined && Number(fwdTokenVersion) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Session expired. Please login again' });
    }

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
