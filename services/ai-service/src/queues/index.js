import { Queue } from 'bullmq';
import { createRedisClient, isRedisEnabled } from '@dc/redis';
import { createLogger } from '@dc/logger';
import { handlers } from '../jobs/handlers.js';

// enqueue: BullMQ when Redis is on; inline handler execution otherwise.
// Ported from the monolith queues/index.js.
const log = createLogger('ai-service:queues');

const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

let connection;
const getConnection = () => {
  if (!isRedisEnabled) return null;
  if (!connection) connection = createRedisClient({ maxRetriesPerRequest: null });
  return connection;
};

const queues = new Map();
const getQueue = (name) => {
  if (!queues.has(name)) queues.set(name, new Queue(name, { connection: getConnection() }));
  return queues.get(name);
};

export const enqueue = async (queueName, data, opts = {}) => {
  if (!isRedisEnabled) {
    const handler = handlers[queueName];
    if (!handler) throw new Error(`No inline handler for queue "${queueName}"`);
    return handler(data);
  }
  return getQueue(queueName).add(queueName, data, { ...DEFAULT_JOB_OPTS, ...opts });
};

export const closeQueues = async () => {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => {})));
  queues.clear();
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
};

if (isRedisEnabled) log.info('BullMQ producers ready (Redis enabled)');
