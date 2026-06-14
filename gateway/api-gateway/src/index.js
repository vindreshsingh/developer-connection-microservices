import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '@dc/auth';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { initSentry, captureException } from '@dc/observability';
import { ensureCsrfSession, generateCsrfToken, doubleCsrfProtection } from './csrf.js';

const log = createLogger('api-gateway');
initSentry('api-gateway');
const app = express();
const PORT = process.env.PORT ?? 4000;

const matchPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// Security headers at the edge — applied to every response before proxying,
// so all proxied microservices are covered from one place.
// crossOriginResourcePolicy is relaxed because the SPA on a different origin
// must be able to consume gateway responses.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(cookieParser());

// Edge authentication.
//
// 1) SECURITY: always strip any client-supplied internal header first — a
//    downstream service trusts it implicitly, so a client must never be able to
//    set it and impersonate another user.
// 2) Verify the JWT cookie once here. On success, forward a trusted internal
//    header carrying the user id. Downstream services read it via @dc/auth's
//    requireUser instead of re-validating the cookie.
app.use((req, _res, next) => {
  delete req.headers[config.internalAuthHeader];
  delete req.headers[config.internalTokenVersionHeader];
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = verifyToken(token);
      const userId = decoded.id ?? decoded._id ?? decoded.sub;
      if (userId) {
        req.headers[config.internalAuthHeader] = String(userId);
        // Forward tokenVersion so user-doc-loading services can enforce
        // revocation (password reset / logout-everywhere) with parity.
        if (decoded.tokenVersion !== undefined)
          req.headers[config.internalTokenVersionHeader] = String(decoded.tokenVersion);
      }
    }
  } catch {
    // Anonymous/invalid token — the downstream service decides whether auth is
    // required for this route.
  }
  next();
});

// The gateway's own liveness check (distinct from upstreams' /health).
app.get('/_gateway/health', (_req, res) =>
  res.json({ status: 'ok', service: 'api-gateway' }),
);

// --- CSRF protection ---------------------------------------------------------
// Establish the CSRF session cookie for every request, then expose a token
// endpoint the SPA calls before issuing mutations. doubleCsrfProtection rejects
// any non-ignored method (POST/PUT/PATCH/DELETE) whose `x-csrf-token` header
// doesn't match — covering all proxied microservices.
app.use(ensureCsrfSession);

app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

app.use(doubleCsrfProtection);

// --- Service routing table ---------------------------------------------------
// Each prefix is proxied to its owning microservice. Anything not listed here
// returns 404 (the monolith fallthrough was removed once all domains migrated).
const ROUTES = [
  // M6: identity-service owns /auth (signup/login/logout/password/email) AND
  // the OAuth sub-routes (/auth/oauth/:provider[/callback]) — one prefix covers
  // both. profile-service owns /profile.
  { prefix: '/auth', target: process.env.IDENTITY_URL }, // M6
  { prefix: '/profile', target: process.env.PROFILE_URL }, // M6
  { prefix: '/notifications', target: process.env.NOTIFICATION_URL }, // M2
  { prefix: '/ai', target: process.env.AI_URL }, // M3
  { prefix: '/jobs', target: process.env.JOB_URL }, // M3
  { prefix: '/posts', target: process.env.POST_URL }, // M3
  { prefix: '/billing', target: process.env.BILLING_URL }, // M4
  { prefix: '/request', target: process.env.CONNECTION_URL }, // M4
  { prefix: '/chat', target: process.env.CHAT_URL }, // M5
  { prefix: '/groups', target: process.env.GROUP_URL }, // M5
  { prefix: '/calls', target: process.env.CALL_URL }, // M5
  // M5: Socket.IO front door. http-proxy-middleware (ws: true) honors the
  // pathFilter on the upgrade event too, so both the HTTP polling handshake
  // (`GET /socket.io/?...`) and the WebSocket upgrade go to the realtime-gateway.
  { prefix: '/socket.io', target: process.env.REALTIME_URL }, // M5
];

const onProxyError = (err, _req, res) => {
  log.error({ err: err.message }, 'upstream proxy error');
  captureException(err);
  if (!res.headersSent) {
    res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream unavailable' } });
  }
};

let socketIoProxy;

for (const { prefix, target } of ROUTES) {
  if (!target) continue;
  const isSocketIo = prefix === '/socket.io';
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: isSocketIo,
    pathFilter: (pathname) => matchPrefix(pathname, prefix),
    on: { error: onProxyError },
  });
  app.use(proxy);
  if (isSocketIo) socketIoProxy = proxy;
  log.info(`Routing ${prefix} -> ${target}${isSocketIo ? ' (ws)' : ''}`);
}

// No match: every domain has been migrated to a microservice, so there is no
// monolith fallthrough anymore. Anything not handled by a route above is a
// genuine 404.
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
});

// Error handler — must be last. Turns doubleCsrfProtection's rejection (and any
// other thrown error) into a JSON response instead of Express's HTML default.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode ?? 500;
  if (status === 403 && err.code === 'EBADCSRFTOKEN') {
    log.warn({ path: req.path, method: req.method }, 'CSRF validation failed');
  } else {
    log.error({ err: err.message }, 'gateway error');
  }
  if (!res.headersSent) {
    res.status(status).json({
      error: {
        code: err.code ?? 'INTERNAL',
        message: status < 500 ? err.message : 'Internal server error',
      },
    });
  }
});

// http-proxy-middleware requires an explicit `upgrade` handler on the HTTP
// server — `app.listen()` alone leaves WebSocket handshakes hanging (pending).
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url?.split('?')[0] ?? '';
  if (socketIoProxy && matchPrefix(pathname, '/socket.io')) {
    socketIoProxy.upgrade(req, socket, head);
    return;
  }
  socket.destroy();
});

server.listen(PORT, () => log.info(`api-gateway listening on :${PORT}`));
