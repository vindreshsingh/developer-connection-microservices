export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  redisUrl: process.env.REDIS_URL,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  internalAuthHeader: process.env.INTERNAL_AUTH_HEADER ?? 'x-internal-user',
};

export default config;
