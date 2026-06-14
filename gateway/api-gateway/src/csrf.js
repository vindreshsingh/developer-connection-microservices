import crypto from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
import { config } from '@dc/config';

// CSRF protection for the gateway, using csrf-csrf's double-submit-cookie
// pattern. The server sets an httpOnly secret cookie; the client must echo the
// matching token in the `x-csrf-token` header on every state-changing request.
// Because the token lives in a header (not a cookie), a cross-site attacker
// riding the user's auth cookie can't supply it.
const isProd = config.nodeEnv === 'production';

// Stable, opaque per-browser identifier the CSRF secret is bound to. Kept in
// its own httpOnly cookie (not the auth cookie) so tokens survive login/logout
// — otherwise the identifier would change at login and silently invalidate
// every issued token.
const CSRF_SID_COOKIE = isProd ? '__Host-dc.csrf.sid' : 'dc.csrf.sid';

// Requests that legitimately can't carry a CSRF token:
//   /billing/webhook — Razorpay server-to-server, authenticated by signature.
//   /socket.io        — Socket.IO's polling transport POSTs + the WS upgrade.
const SKIP_PREFIXES = ['/billing/webhook', '/socket.io'];
const matchPrefix = (p, prefix) => p === prefix || p.startsWith(`${prefix}/`);

export const ensureCsrfSession = (req, res, next) => {
  if (!req.cookies?.[CSRF_SID_COOKIE]) {
    const sid = crypto.randomUUID();
    res.cookie(CSRF_SID_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
    });
    // Make it readable by getSessionIdentifier within this same request.
    req.cookies = { ...req.cookies, [CSRF_SID_COOKIE]: sid };
  }
  next();
};

const { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => config.csrfSecret,
  getSessionIdentifier: (req) => req.cookies?.[CSRF_SID_COOKIE] ?? '',
  cookieName: isProd ? '__Host-dc.x-csrf-token' : 'dc.x-csrf-token',
  cookieOptions: { sameSite: 'lax', path: '/', secure: isProd, httpOnly: true },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  skipCsrfProtection: (req) => SKIP_PREFIXES.some((prefix) => matchPrefix(req.path, prefix)),
  errorConfig: {
    statusCode: 403,
    message: 'Invalid CSRF token',
    code: 'EBADCSRFTOKEN',
  },
});

export { generateCsrfToken, doubleCsrfProtection, invalidCsrfTokenError };
