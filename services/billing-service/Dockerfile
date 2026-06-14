# Build from the MONOREPO ROOT:  docker build -f services/billing-service/Dockerfile -t billing-service .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/billing-service ./services/billing-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/billing-service
EXPOSE 4007
CMD ["node", "src/index.js"]
