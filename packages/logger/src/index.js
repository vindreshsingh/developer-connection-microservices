import pino from 'pino';

export const createLogger = (service) =>
  pino({
    name: service,
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
  });

export default createLogger;
