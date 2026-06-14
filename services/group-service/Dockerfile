# Build from the MONOREPO ROOT:  docker build -f services/group-service/Dockerfile -t group-service .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/group-service ./services/group-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/group-service
EXPOSE 4005
CMD ["node", "src/index.js"]
