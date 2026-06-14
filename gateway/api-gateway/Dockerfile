# Build from the MONOREPO ROOT:  docker build -f gateway/api-gateway/Dockerfile -t api-gateway .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY gateway/api-gateway ./gateway/api-gateway
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/gateway/api-gateway
EXPOSE 4000
CMD ["node", "src/index.js"]
