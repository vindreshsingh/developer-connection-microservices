# Build from the MONOREPO ROOT:  docker build -f services/connection-service/Dockerfile -t connection-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/connection-service ./services/connection-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/connection-service
EXPOSE 4003
CMD ["pnpm", "start"]
