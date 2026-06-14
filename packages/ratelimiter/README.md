# @dc/ratelimiter

Express rate limiters ported from the monolith's `middlewares/rateLimiter.js`.
Redis-backed store (shared across instances) when `REDIS_URL` is set; in-memory
fallback otherwise. Exposes `createRateLimiter`, plus `swipeRateLimiter` and
`checkoutRateLimiter` with the same thresholds/prefixes as the monolith.
