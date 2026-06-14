# Build from the MONOREPO ROOT:  docker build -f gateway/realtime-gateway/Dockerfile -t realtime-gateway .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY gateway/realtime-gateway ./gateway/realtime-gateway
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/gateway/realtime-gateway
EXPOSE 4020
CMD ["node", "src/index.js"]
