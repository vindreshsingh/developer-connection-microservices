/**
 * Drains the shared `email` BullMQ queue for identity-service transactional mail
 * (verification + password reset). Without REDIS_URL the API sends inline instead,
 * so this process is only needed when Redis is enabled.
 */
import { fileURLToPath } from 'node:url';
import { Worker } from 'bullmq';
import { createRedisClient, isRedisEnabled } from '@dc/redis';
import { createLogger } from '@dc/logger';
import { sendEmail } from './lib/email.js';

const log = createLogger('identity-worker');
const QUEUE_NAME = 'email';

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(process.argv[1]);

if (isMain) {
  if (!isRedisEnabled) {
    log.error('REDIS_URL required — identity-service sends email inline without Redis. Exiting.');
    process.exit(1);
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await sendEmail(job.data);
    },
    {
      connection: createRedisClient({ maxRetriesPerRequest: null }),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 5,
    },
  );

  worker.on('completed', (job) => log.info(`email job ${job.id} completed`));
  worker.on('failed', (job, err) => log.error(`email job ${job?.id} failed: ${err.message}`));

  log.info(`Worker listening on queue "${QUEUE_NAME}"`);

  const shutdown = async () => {
    log.info('Shutting down email worker...');
    await worker.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
