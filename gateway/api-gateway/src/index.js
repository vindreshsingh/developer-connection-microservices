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

// Verify the JWT once at the edge, then forward a trusted internal header.
// Routes the monolith owns still work because the monolith ignores the header
// and reads its own cookie — so this is safe during the Strangler-Fig phase.
app.use((req, _res, next) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = verifyToken(token);
      req.headers[config.internalAuthHeader] = decoded._id ?? decoded.id ?? decoded.sub;
    }
  } catch {
    // Anonymous request — downstream decides whether auth is required.
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// --- Service routing table ---------------------------------------------------
// As each service goes live, point its prefix at the new service URL below.
// Until then, everything falls through to the monolith.
const ROUTES = [
  // { prefix: '/notifications', target: process.env.NOTIFICATION_URL },
  // { prefix: '/ai',            target: process.env.AI_URL },
];

for (const { prefix, target } of ROUTES) {
  if (target) {
    app.use(prefix, createProxyMiddleware({ target, changeOrigin: true }));
    log.info(`Routing ${prefix} -> ${target}`);
  }
}

// Default: proxy everything else to the existing monolith (M1).
app.use('/', createProxyMiddleware({ target: MONOLITH_URL, changeOrigin: true, ws: true }));

app.listen(PORT, () => log.info(`api-gateway listening on :${PORT} -> monolith ${MONOLITH_URL}`));
