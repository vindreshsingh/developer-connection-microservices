import express from 'express';
import mongoose from 'mongoose';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('post-service');
const app = express();
const PORT = process.env.PORT ?? 4009;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

app.use(express.json());

app.use((req, _res, next) => {
  log.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'post-service',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

app.use('/posts', routes);
app.use(errorHandler);

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    app.listen(PORT, () => log.info(`post-service listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export default app;
