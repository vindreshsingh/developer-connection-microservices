import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('chat-service');
const app = express();
const PORT = process.env.PORT ?? 4004;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'chat-service' }));

app.use('/chat', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('chat-service listening on :' + PORT));

export default app;
