import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('job-service');
const app = express();
const PORT = process.env.PORT ?? 4011;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'job-service' }));

app.use('/jobs', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('job-service listening on :' + PORT));

export default app;
