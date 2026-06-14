import express from 'express';
import mongoose from 'mongoose';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('ai-service');
const app = express();
const PORT = process.env.PORT ?? 4008;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

app.use(express.json());

// Lightweight request log — also serves as proof the gateway routed here.
app.use((req, _res, next) => {
  log.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'ai-service',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

app.use('/ai', routes);
app.use(errorHandler);

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    app.listen(PORT, () => log.info(`ai-service listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export default app;
