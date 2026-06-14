# Build from the MONOREPO ROOT:  docker build -f services/identity-service/Dockerfile -t identity-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/identity-service ./services/identity-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/identity-service
EXPOSE 4001
CMD ["pnpm", "start"]
