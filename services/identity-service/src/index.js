import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('identity-service');
const app = express();
const PORT = process.env.PORT ?? 4001;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'identity-service' }));

app.use('/auth', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('identity-service listening on :' + PORT));

export default app;
