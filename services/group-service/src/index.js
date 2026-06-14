import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('group-service');
const app = express();
const PORT = process.env.PORT ?? 4005;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'group-service' }));

app.use('/groups', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('group-service listening on :' + PORT));

export default app;
