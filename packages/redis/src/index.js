import Redis from 'ioredis';
import { createLogger } from '@dc/logger';

// Ported from the monolith (backend/src/config/redis.js). Redis is OPTIONAL:
// with REDIS_URL unset, every consumer degrades to in-memory/no-op behavior.
const log = createLogger('redis');

export const REDIS_URL = process.env.REDIS_URL || '';
export const isRedisEnabled = Boolean(REDIS_URL);

const baseOptions = {
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
};

export const createRedisClient = (overrides = {}) => {
  if (!isRedisEnabled) return null;
  const client = new Redis(REDIS_URL, { ...baseOptions, ...overrides });
  client.on('error', (err) => log.error(`Redis error: ${err.message}`));
  return client;
};

let singleton = null;

export const getRedis = () => {
  if (!isRedisEnabled) return null;
  if (!singleton) {
    singleton = createRedisClient();
    singleton.on('connect', () => log.info('Redis connected'));
  }
  return singleton;
};

export const closeRedis = async () => {
  if (singleton) {
    await singleton.quit().catch(() => {});
    singleton = null;
  }
};
