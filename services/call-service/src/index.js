import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('call-service');
const app = express();
const PORT = process.env.PORT ?? 4006;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'call-service' }));

app.use('/calls', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('call-service listening on :' + PORT));

export default app;
