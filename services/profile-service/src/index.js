import express from 'express';
import { createLogger } from '@dc/logger';
import { errorHandler } from '@dc/errors';
import routes from './routes/index.js';

const log = createLogger('profile-service');
const app = express();
const PORT = process.env.PORT ?? 4002;

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'profile-service' }));

app.use('/profile', routes);

app.use(errorHandler);

app.listen(PORT, () => log.info('profile-service listening on :' + PORT));

export default app;
