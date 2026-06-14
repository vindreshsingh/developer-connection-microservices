import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('ai-service');
const app = express();
const PORT = process.env.PORT ?? 4008;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ai-service' }));

app.use('/ai', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('ai-service listening on :' + PORT));

export default app;
