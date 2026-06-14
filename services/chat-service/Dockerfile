# Build from the MONOREPO ROOT:  docker build -f services/chat-service/Dockerfile -t chat-service .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/chat-service ./services/chat-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/chat-service
EXPOSE 4004
CMD ["node", "src/index.js"]
