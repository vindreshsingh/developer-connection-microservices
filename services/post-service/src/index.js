import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('post-service');
const app = express();
const PORT = process.env.PORT ?? 4009;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'post-service' }));

app.use('/posts', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('post-service listening on :' + PORT));

export default app;
