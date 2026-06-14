# Build from the MONOREPO ROOT:  docker build -f services/notification-service/Dockerfile -t notification-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/notification-service ./services/notification-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/notification-service
EXPOSE 4010
CMD ["pnpm", "start"]
