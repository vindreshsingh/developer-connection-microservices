# connection-service

Connection requests (swipes), accepted connections, blocking, reports.

- **Port:** `4003`
- **Route prefixes:** `/request`
- **Owned models:** `connectionRequest`, `report`
- **Reads (shared-DB phase):** billing's `plan` (free-tier swipe cap)
- **Writes (shared-DB phase):** `users.blockedUsers` (cross-context, decouple in M6)
- **Publishes (target):** `connection.requested`, `connection.accepted`, `user.blocked`

## Status: M4 — extracted, shared-DB phase

All `/request/*` routes are served here (gateway routes `/request` -> this
service). The free-tier daily swipe cap reads `Plan.features.dailySwipeLimit`
from billing's collection; block/unblock writes `users.blockedUsers`. Both are
shared-DB couplings to resolve via APIs/events in M6.

User-doc auth re-checks `tokenVersion` (gateway forwards it), matching the
monolith's userAuth.

## Local run
```bash
cp .env.example .env   # set MONGO_URI (shared)
corepack pnpm --filter connection-service start
```

## Migration checklist
- [x] Port routes + models (connectionRequest, report).
- [x] Port swipe cap + blocking/report logic; user-doc auth with tokenVersion.
- [x] Flip the gateway route to this service (`CONNECTION_URL`).
- [ ] Remove `/request` routes from the monolith (final cutover).
- [ ] Read plan/premium via billing API; write blocks via profile API (M6).
- [ ] Own its database; add tests.
