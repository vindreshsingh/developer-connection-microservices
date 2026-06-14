import { getRedis } from '@dc/redis';
import { createLogger } from '@dc/logger';

// Ported from the monolith (backend/src/utils/cache.js). Degrades safely: with
// Redis disabled, get() is always a miss and set()/del() are no-ops, and a
// Redis error is treated as a miss rather than failing the request.
const log = createLogger('cache');

export const get = async (key) => {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    log.warn(`cache get failed for ${key}: ${err.message}`);
    return null;
  }
};

export const set = async (key, value, ttlSeconds) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    const raw = JSON.stringify(value);
    if (ttlSeconds) await redis.set(key, raw, 'EX', ttlSeconds);
    else await redis.set(key, raw);
  } catch (err) {
    log.warn(`cache set failed for ${key}: ${err.message}`);
  }
};

export const del = async (...keys) => {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    log.warn(`cache del failed: ${err.message}`);
  }
};

export const remember = async (key, ttlSeconds, compute) => {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await compute();
  if (fresh !== null && fresh !== undefined) await set(key, fresh, ttlSeconds);
  return fresh;
};
