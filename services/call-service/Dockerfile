# Build from the MONOREPO ROOT:  docker build -f services/call-service/Dockerfile -t call-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/call-service ./services/call-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/call-service
EXPOSE 4006
CMD ["pnpm", "start"]
