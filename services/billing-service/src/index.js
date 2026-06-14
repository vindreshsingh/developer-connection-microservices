import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('billing-service');
const app = express();
const PORT = process.env.PORT ?? 4007;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'billing-service' }));

app.use('/billing', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('billing-service listening on :' + PORT));

export default app;
