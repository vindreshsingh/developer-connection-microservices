# Build from the MONOREPO ROOT:  docker build -f services/job-service/Dockerfile -t job-service .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/job-service ./services/job-service
RUN pnpm install --frozen-lockfile=false

WORKDIR /app/services/job-service
EXPOSE 4011
CMD ["pnpm", "start"]
