# @dc/redis

Shared ioredis client factory + singleton, ported from the monolith's
`config/redis.js`. Redis is optional — `isRedisEnabled` is `false` when
`REDIS_URL` is unset, and consumers degrade gracefully.
