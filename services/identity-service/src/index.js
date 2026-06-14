import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { initSentry } from '@dc/observability';
import { errorHandler } from '@dc/errors';
import passport, { configurePassport } from './middlewares/passport.js';
import routes from './routes/index.js';

const log = createLogger('identity-service');
initSentry('identity-service');
const app = express();
const PORT = process.env.PORT ?? 4001;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

app.use(express.json());
app.use(cookieParser()); // OAuth state cookie + token cookie reads
configurePassport();
app.use(passport.initialize());

app.use((req, _res, next) => {
  log.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'identity-service',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);

app.use('/auth', routes);
app.use(errorHandler);

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    app.listen(PORT, () => log.info(`identity-service listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export default app;
