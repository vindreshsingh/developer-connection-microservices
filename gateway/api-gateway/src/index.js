import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '@dc/auth';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';

const log = createLogger('api-gateway');
const app = express();
const PORT = process.env.PORT ?? 4000;
const MONOLITH_URL = process.env.MONOLITH_URL ?? 'http://localhost:3008';

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
//
// During M1 the monolith still reads its OWN `token` cookie (forwarded
// unchanged by the proxy) and simply ignores the extra header — so wrapping it
// is a zero-behavior-change, reversible step.
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
    // Anonymous/invalid token — downstream (or the monolith) decides whether
    // auth is required for this route.
  }
  next();
});

// The gateway's own liveness check (distinct from upstreams' /health).
app.get('/_gateway/health', (_req, res) =>
  res.json({ status: 'ok', service: 'api-gateway', monolith: MONOLITH_URL }),
);

// --- Service routing table ---------------------------------------------------
// Strangler Fig: as each microservice goes live, point its prefix at the new
// service URL here. Anything not listed falls through to the monolith below.
const ROUTES = [
  { prefix: '/notifications', target: process.env.NOTIFICATION_URL }, // M2
  { prefix: '/ai', target: process.env.AI_URL }, // M3
  { prefix: '/jobs', target: process.env.JOB_URL }, // M3
  { prefix: '/posts', target: process.env.POST_URL }, // M3
];

const onProxyError = (err, _req, res) => {
  log.error({ err: err.message }, 'upstream proxy error');
  if (!res.headersSent) {
    res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream unavailable' } });
  }
};

for (const { prefix, target } of ROUTES) {
  if (!target) continue;
  // Mount at root with a pathFilter (not app.use(prefix, ...)) so the FULL
  // original path — including the prefix — is forwarded to the service. Using
  // an Express mount path would strip the prefix before proxying.
  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      // Predicate (not a glob) so matching is deterministic: the whole prefix
      // and any sub-path go to the service; the leading-segment check avoids
      // matching look-alikes like `/notifications-archive`.
      pathFilter: (pathname) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      on: { error: onProxyError },
    }),
  );
  log.info(`Routing ${prefix} -> ${target}`);
}

// Default: proxy everything else (REST + WebSocket upgrade) to the monolith.
app.use(
  '/',
  createProxyMiddleware({
    target: MONOLITH_URL,
    changeOrigin: true,
    ws: true,
    on: { error: onProxyError },
  }),
);

app.listen(PORT, () => log.info(`api-gateway listening on :${PORT} -> monolith ${MONOLITH_URL}`));
