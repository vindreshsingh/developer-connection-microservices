# Build from the MONOREPO ROOT:  docker build -f services/ai-service/Dockerfile -t ai-service .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/ai-service ./services/ai-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/ai-service
EXPOSE 4008
CMD ["node", "src/index.js"]
