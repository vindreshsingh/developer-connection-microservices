# developer-connection-microservices

Monorepo (pnpm + Turborepo) for the microservices migration of
`developer-connection`. See the migration plan in the main repo:
`docs/migration/monolith-to-microservices.md`.

## Layout
- `gateway/api-gateway` — edge: authn, routing, rate-limit, CORS. Proxies
  extracted routes to microservices; everything else falls through to the
  monolith (Strangler Fig).
- `gateway/realtime-gateway` — Socket.IO front door (M5).
- `services/*` — one Express service per bounded context.
- `packages/*` — shared libraries (logger, errors, auth, events, config, mongo).

## Quick start
```bash
pnpm install
cp gateway/api-gateway/.env.example gateway/api-gateway/.env   # optional local dev
cp services/identity-service/.env.example services/identity-service/.env
cp services/profile-service/.env.example services/profile-service/.env
pnpm docker:up        # mongo + redis + all services + gateway
pnpm dev              # run all services in watch mode (without Docker)
```

Each service loads `.env` from its cwd automatically via `@dc/config` (dotenv).

For transactional email with Redis enabled, also run the identity email worker:
```bash
pnpm --filter identity-service worker:dev
```

## Services (ports match `gateway/api-gateway/.env.example`)
- **identity-service** (`:4001`) — /auth — Account system-of-record: signup, login, JWT issuance, OAuth, password reset, email verification.
- **profile-service** (`:4005`) — /profile — Public profiles, photos, GitHub/LinkedIn enrichment, discovery feed.
- **connection-service** (`:4003`) — /request — Connection requests, blocking, reporting.
- **chat-service** (`:4002`) — /chat — Direct messaging conversations + message history (realtime via realtime-gateway).
- **group-service** (`:4004`) — /groups — Groups and group messaging.
- **call-service** (`:4006`) — /calls — 1:1 and group video calls (LiveKit tokens + signaling).
- **billing-service** (`:4007`) — /billing — Razorpay subscriptions, plans, webhooks, payment history.
- **ai-service** (`:4008`) — /ai — AI match recommendations, resume feedback, mock interviews.
- **post-service** (`:4009`) — /posts — Developer feed: posts, comments, likes.
- **notification-service** (`:4010`) — /notifications — Notification storage + fan-out.
- **job-service** (`:4011`) — /jobs — Job board: postings and applications.
- **realtime-gateway** (`:4020`) — Socket.IO — presence, chat/group/call signaling.

## Shared DB (current phase)
All extracted services connect to the **same** MongoDB database as the monolith
(`developer-connection`) until the per-service DB split (M6 tail). `docker-compose.yml`
reflects this.

## Migration status
Services are extracted incrementally; the gateway routes each prefix as it goes
live. M1–M6 code splits are done; monolith route removal + DB decomposition is
the remaining operational tail.
