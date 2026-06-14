import express from 'express';
import mongoose from 'mongoose';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { initSentry } from '@dc/observability';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('billing-service');
initSentry('billing-service');
const app = express();
const PORT = process.env.PORT ?? 4007;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

// Razorpay webhook signature verification needs the exact raw bytes, so this
// path is parsed as a Buffer and excluded from express.json() (which skips a
// request whose body was already parsed). The gateway streams the body
// untouched (it never calls express.json), so the signed bytes arrive intact.
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use((req, _res, next) => {
  log.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'billing-service',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

app.use('/billing', routes);
app.use(errorHandler);

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    app.listen(PORT, () => log.info(`billing-service listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export default app;
