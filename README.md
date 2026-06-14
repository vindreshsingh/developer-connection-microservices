# developer-connection-microservices

Monorepo (pnpm + Turborepo) for the microservices migration of
`developer-connection`. See the migration plan in the main repo:
`docs/migration/monolith-to-microservices.md`.

## Layout
- `gateway/api-gateway` — edge: authn, routing, rate-limit, CORS. In M1 it
  proxies **everything** to the existing monolith; routes are flipped to new
  services one at a time (Strangler Fig).
- `services/*` — one Express service per bounded context.
- `packages/*` — shared libraries (logger, errors, auth, events, config, mongo).

## Quick start
```bash
pnpm install
pnpm docker:up        # redis + mongo (+ optionally the monolith)
pnpm dev              # run all services in watch mode
```

## Services
- **identity-service** (`:4001`) — /auth — Account system-of-record: signup, login, JWT issuance, OAuth, password reset, email verification.
- **profile-service** (`:4002`) — /profile — Public profiles, photos, GitHub/LinkedIn enrichment, discovery feed.
- **connection-service** (`:4003`) — /request — Connection requests, blocking, reporting.
- **chat-service** (`:4004`) — /chat — Direct messaging conversations + message history (realtime via realtime-gateway).
- **group-service** (`:4005`) — /groups — Groups and group messaging.
- **call-service** (`:4006`) — /calls — 1:1 and group video calls (LiveKit tokens + signaling).
- **billing-service** (`:4007`) — /billing — Razorpay subscriptions, plans, webhooks, payment history.
- **ai-service** (`:4008`) — /ai — AI match recommendations, resume feedback, mock interviews.
- **post-service** (`:4009`) — /posts — Developer feed: posts, comments, likes.
- **notification-service** (`:4010`) — /notifications — Notification storage + fan-out (consumes domain events from every service).
- **job-service** (`:4011`) — /jobs — Job board: postings and applications.

## Migration status
Each service starts as a **skeleton** (health check + stubbed routes). Port real
logic from the monolith one route group at a time, then flip the gateway route.
