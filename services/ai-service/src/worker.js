/**
 * ai-service worker — drains the ai-recommendations queue when Redis is enabled.
 * Ported from the monolith worker.js (ai subset). Separate deployable:
 * `pnpm --filter ai-service worker`. Without REDIS_URL there is no queue (the
 * service generates recommendations inline), so this exits.
 */

import { Worker } from 'bullmq';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { isRedisEnabled, createRedisClient } from '@dc/redis';
import { createLogger } from '@dc/logger';
import { QUEUE_NAMES } from './queues/names.js';
import { handlers } from './jobs/handlers.js';

const log = createLogger('ai-service:worker');

if (!isRedisEnabled) {
  log.error('Worker requires REDIS_URL — nothing to do without a queue. Exiting.');
  process.exit(1);
}

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 5;
const workers = [];

const start = async () => {
  await connectMongo(process.env.MONGO_URI ?? config.mongoUri);

  for (const name of QUEUE_NAMES) {
    const handler = handlers[name];
    if (!handler) {
      log.warn(`No handler registered for queue "${name}" — skipping.`);
      continue;
    }
    const worker = new Worker(name, async (job) => handler(job.data), {
      connection: createRedisClient({ maxRetriesPerRequest: null }),
      concurrency: WORKER_CONCURRENCY,
    });
    worker.on('completed', (job) => log.info(`[${name}] job ${job.id} completed`));
    worker.on('failed', (job, err) => log.error(`[${name}] job ${job?.id} failed: ${err.message}`));
    workers.push(worker);
    log.info(`Worker listening on queue "${name}" (concurrency ${WORKER_CONCURRENCY})`);
  }
};

const shutdown = async () => {
  await Promise.all(workers.map((w) => w.close().catch(() => {})));
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  log.error(`Worker failed to start: ${err.message}`);
  process.exit(1);
});
