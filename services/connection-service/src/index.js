import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('connection-service');
const app = express();
const PORT = process.env.PORT ?? 4003;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'connection-service' }));

app.use('/request', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('connection-service listening on :' + PORT));

export default app;
