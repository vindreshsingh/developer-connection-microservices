/**
 * OAuth login routes — ported from the monolith (backend/src/routes/oauth.js).
 * Mounted under /auth (so paths are /auth/oauth/:provider[/callback]).
 *
 * State/CSRF: random `state` stored in an httpOnly cookie on initiate, compared
 * on callback. Stateless otherwise — auth state is the JWT cookie.
 */

import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { createLogger } from '@dc/logger';
import passport from '../middlewares/passport.js';
import { tokenCookieOptions } from '../lib/cookies.js';

const router = Router();
const log = createLogger('identity-service:oauth');

const SUPPORTED_PROVIDERS = new Set(['github', 'google', 'linkedin']);
const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

router.get('/oauth/:provider', (req, res, next) => {
  const { provider } = req.params;

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: `Unsupported OAuth provider: ${provider}` });
  }

  const state = randomBytes(16).toString('hex');

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: STATE_TTL_MS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  passport.authenticate(provider, { state, session: false })(req, res, next);
});

router.get('/oauth/:provider/callback', (req, res, next) => {
  const { provider } = req.params;

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: `Unsupported OAuth provider: ${provider}` });
  }

  const cookieState = req.cookies[STATE_COOKIE];
  const queryState = req.query.state;

  if (!cookieState || !queryState || cookieState !== queryState) {
    res.clearCookie(STATE_COOKIE);
    return res.status(400).json({ error: 'Invalid OAuth state. Possible CSRF attack.' });
  }

  res.clearCookie(STATE_COOKIE);

  passport.authenticate(provider, { session: false }, (err, user) => {
    if (err) {
      log.error(`[OAuth] Error from ${provider}: ${err.message}`);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_no_user`);
    }

    const token = user.getJWT();
    res.cookie('token', token, tokenCookieOptions);

    if (user._needsEmail) {
      return res.redirect(`${process.env.FRONTEND_URL}/complete-profile?needsEmail=true`);
    }

    return res.redirect(`${process.env.FRONTEND_URL}/`);
  })(req, res, next);
});

export default router;
