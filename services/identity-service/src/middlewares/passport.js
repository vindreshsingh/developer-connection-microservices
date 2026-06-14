import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { upsertOAuthUser } from '../lib/oauthService.js';

// Ported verbatim from the monolith (backend/src/middlewares/passport.js).
// All strategies are stateless (session: false) — auth state is the JWT cookie.
//
// OAUTH_CALLBACK_BASE_URL must point at the public gateway origin (e.g.
// https://api.example.com) so providers redirect back through the gateway,
// which proxies /auth/oauth/* to this service.
function splitName(displayName = '') {
  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: parts[0] || 'User',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
  };
}

function callbackBase() {
  return process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:4000';
}

function makeGitHubStrategy() {
  return new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || 'gh-test-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'gh-test-secret',
      callbackURL: `${callbackBase()}/auth/oauth/github/callback`,
      scope: [],
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const primaryEmail = profile.emails?.[0]?.value || profile._json?.email || null;
        const { firstName, lastName } = splitName(profile.displayName || profile.username || '');

        const user = await upsertOAuthUser({
          provider: 'github',
          providerId: profile.id,
          email: primaryEmail,
          firstName,
          lastName,
          photoUrl: profile.photos?.[0]?.value || null,
          rawToken: accessToken,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  );
}

function makeGoogleStrategy() {
  return new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'google-test-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'google-test-secret',
      callbackURL: `${callbackBase()}/auth/oauth/google/callback`,
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const { firstName, lastName } = splitName(profile.displayName);

        const user = await upsertOAuthUser({
          provider: 'google',
          providerId: profile.id,
          email,
          firstName,
          lastName,
          photoUrl: profile.photos?.[0]?.value || null,
          rawToken: accessToken,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  );
}

function makeLinkedInStrategy() {
  return new LinkedInStrategy(
    {
      clientID: process.env.LINKEDIN_CLIENT_ID || 'li-test-id',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || 'li-test-secret',
      callbackURL: `${callbackBase()}/auth/oauth/linkedin/callback`,
      scope: ['r_emailaddress', 'r_liteprofile'],
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const { firstName, lastName } = splitName(profile.displayName || '');

        const user = await upsertOAuthUser({
          provider: 'linkedin',
          providerId: profile.id,
          email,
          firstName,
          lastName,
          photoUrl: profile.photos?.[0]?.value || null,
          rawToken: accessToken,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  );
}

export function configurePassport() {
  passport.use('github', makeGitHubStrategy());
  passport.use('google', makeGoogleStrategy());
  passport.use('linkedin', makeLinkedInStrategy());
}

export default passport;
