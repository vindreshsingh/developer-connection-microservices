import jwt from 'jsonwebtoken';
import { config } from '@dc/config';
import { validateSession, getProfile } from '@dc/service-clients';

// Verify a JWT (used by the gateway at the edge).
export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

/**
 * Config-driven Premium override for test/comp accounts. If the request's
 * userId (always available) or req.user.email (when present) is in
 * config.premiumAllowlist, force req.user.isPremium = true. Call right after
 * req.user is populated, before next(). No-op when the allowlist is empty.
 */
export const applyPremiumAllowlist = (req) => {
  const list = config.premiumAllowlist;
  if (!list?.length || !req.user) return;
  const id = req.userId != null ? String(req.userId).toLowerCase() : '';
  const email = req.user.email ? String(req.user.email).toLowerCase() : '';
  if ((id && list.includes(id)) || (email && list.includes(email))) {
    req.user.isPremium = true;
  }
};

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
    applyPremiumAllowlist(req);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Service-to-service routes (internal/*) — not exposed through the public gateway.
export const requireServiceToken = (req, res, next) => {
  const token = req.headers['x-internal-service-token'];
  if (!token || token !== config.internalServiceToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

/**
 * Auth middleware for services that do NOT own profile data. Validates the
 * session against identity-service and loads the profile projection from
 * profile-service (database-per-service — no cross-DB User reads).
 */
export const createRemoteUserAuth = () => async (req, res, next) => {
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

    req.user = { ...profile, _id: profile._id || userId };
    req.userId = String(userId);
    applyPremiumAllowlist(req);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
