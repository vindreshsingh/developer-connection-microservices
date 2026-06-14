import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

// Load `.env` from the service cwd when present (local dev). In Docker/k8s, env
// vars are injected directly and this is a no-op.
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) loadDotenv({ path: envPath });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  redisUrl: process.env.REDIS_URL,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  internalAuthHeader: process.env.INTERNAL_AUTH_HEADER ?? 'x-internal-user',
  internalTokenVersionHeader:
    process.env.INTERNAL_TOKEN_VERSION_HEADER ?? 'x-internal-token-version',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? 'dev-internal-token',
  identityUrl: process.env.IDENTITY_URL ?? 'http://localhost:4001',
  profileUrl: process.env.PROFILE_URL ?? 'http://localhost:4005',
  connectionUrl: process.env.CONNECTION_URL ?? 'http://localhost:4003',
};

export default config;
