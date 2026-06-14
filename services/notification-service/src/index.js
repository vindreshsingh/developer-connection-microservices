import express from 'express';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { initSentry } from '@dc/observability';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('notification-service');
initSentry('notification-service');
const app = express();
const PORT = process.env.PORT ?? 4010;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

app.use(express.json());

app.get('/health', async (_req, res) => {
  const mongoState = (await import('mongoose')).default.connection.readyState;
  res.json({ status: 'ok', service: 'notification-service', mongo: mongoState === 1 ? 'connected' : 'disconnected' });
});

app.use('/notifications', routes);
app.use(errorHandler);

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    app.listen(PORT, () => log.info(`notification-service listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export default app;
