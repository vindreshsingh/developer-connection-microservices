import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis, isRedisEnabled } from '@dc/redis';

// Ported from the monolith (backend/src/middlewares/rateLimiter.js). With Redis
// enabled the store is shared across instances so counts are global behind the
// load balancer; without REDIS_URL express-rate-limit falls back to its
// in-memory store (single-instance dev).
const RATE_LIMIT_MESSAGE = { error: 'Too many requests. Please try again in 15 minutes.' };

const buildStore = (prefix) => {
  if (!isRedisEnabled) return undefined;
  return new RedisStore({ prefix, sendCommand: (...args) => getRedis().call(...args) });
};

export const createRateLimiter = (max, windowMs = 15 * 60 * 1000, prefix = 'rl:') =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
    store: buildStore(prefix),
  });

const isTest = process.env.NODE_ENV === 'test';

// Same thresholds/prefixes as the monolith so distributed counts stay coherent
// while routes are served from either place during the migration.
export const swipeRateLimiter = createRateLimiter(isTest ? 1000 : 60, 5 * 60 * 1000, 'rl:swipe:');
export const checkoutRateLimiter = createRateLimiter(isTest ? 1000 : 10, 15 * 60 * 1000, 'rl:checkout:');

// Tight limiter for auth endpoints (signup/login/password reset). Default
// window (15m) and prefix match the monolith so the shared Redis tally is
// coherent whether the route is served by the monolith or identity-service.
export const authRateLimiter = createRateLimiter(isTest ? 1000 : 5000, undefined, 'rl:auth:');
