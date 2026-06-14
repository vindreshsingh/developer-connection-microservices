# Build from the MONOREPO ROOT:  docker build -f services/post-service/Dockerfile -t post-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/post-service ./services/post-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/post-service
EXPOSE 4009
CMD ["pnpm", "start"]
