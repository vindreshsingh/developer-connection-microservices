import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('notification-service');
const app = express();
const PORT = process.env.PORT ?? 4010;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.use('/notifications', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('notification-service listening on :' + PORT));

export default app;
