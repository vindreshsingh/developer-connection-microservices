import { Queue } from 'bullmq';
import { createRedisClient, isRedisEnabled } from '@dc/redis';
import { sendEmail } from './email.js';

// Mirrors the monolith's enqueue-or-inline pattern (backend/src/queues/index.js)
// scoped to the only job identity-service produces: transactional email.
//
// Redis ON  -> add to the shared `email` BullMQ queue, drained by the existing
//              worker (same queue name + Redis, shared-infra phase).
// Redis OFF -> send inline (await), preserving the monolith's local/dev behavior.
const QUEUE_NAME = 'email';

const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

let connection;
let queue;

const getQueue = () => {
  if (!queue) {
    connection = createRedisClient({ maxRetriesPerRequest: null });
    queue = new Queue(QUEUE_NAME, { connection });
  }
  return queue;
};

export const enqueueEmail = async (data, opts = {}) => {
  if (!isRedisEnabled) return sendEmail(data);
  return getQueue().add(QUEUE_NAME, data, { ...DEFAULT_JOB_OPTS, ...opts });
};
