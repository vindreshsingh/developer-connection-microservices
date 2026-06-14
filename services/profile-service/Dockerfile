# Build from the MONOREPO ROOT:  docker build -f services/profile-service/Dockerfile -t profile-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/profile-service ./services/profile-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/profile-service
EXPOSE 4002
CMD ["pnpm", "start"]
