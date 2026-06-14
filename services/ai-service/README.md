# ai-service

AI match recommendations, resume feedback, mock interviews.

- **Port:** `4008`
- **Route prefixes:** `/ai`
- **Owned models:** `aiUsageLog`, `resumeFeedback`, `interviewSession`, `recommendationCache`
- **Reads (shared-DB phase):** `users`, `subscriptions`, `connectionrequests`
- **Publishes (target):** `recommendations.generated`

## Status: M3 — extracted, shared-DB phase

All `/ai/*` routes are served here (gateway routes `/ai` -> this service). Every
route requires auth + active premium (`requirePremium('aiAssistant')`);
LLM-backed routes consume the daily AI budget (`AIUsageLog`).

Graceful degradation matches the monolith:
- **Redis on** → recommendations offload to BullMQ (`pnpm --filter ai-service worker`); `GET /ai/recommendations` returns `202 {status:'generating'}` on a cache miss.
- **Redis off** → recommendations generate inline; cache is a no-op.

Auth: the gateway verifies the JWT and forwards `x-internal-user` +
`x-internal-token-version`; `createUserAuth` loads the user doc and re-checks
`tokenVersion` so revocation still works (parity with the monolith's userAuth).

## Local run
```bash
cp .env.example .env   # set MONGO_URI (shared), ANTHROPIC_API_KEY, CLOUDINARY_*
corepack pnpm --filter ai-service start
# optional, when REDIS_URL is set:
corepack pnpm --filter ai-service worker
```

## Migration checklist
- [x] Port routes, models, services (AIService, RecommendationService).
- [x] Port middlewares (premium gate, AI rate limit) + user-doc auth with tokenVersion.
- [x] Port queue + worker (BullMQ-or-inline) for recommendation generation.
- [x] Flip the gateway route to this service (`AI_URL`).
- [ ] Remove `/ai` routes from the monolith (final cutover).
- [ ] Own its database + decouple cross-context reads (users/subscriptions/connections) via events/APIs (M6).
- [ ] Add automated tests.
