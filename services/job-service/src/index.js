import express from 'express';
import mongoose from 'mongoose';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { initSentry } from '@dc/observability';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('job-service');
initSentry('job-service');
const app = express();
const PORT = process.env.PORT ?? 4011;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

app.use(express.json());

app.use((req, _res, next) => {
  log.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'job-service',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

app.use('/jobs', routes);
app.use(errorHandler);

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    app.listen(PORT, () => log.info(`job-service listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export default app;
