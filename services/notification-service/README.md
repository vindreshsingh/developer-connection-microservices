# notification-service

Notification storage + fan-out (consumes domain events from every service).

- **Port:** `4010`
- **Route prefixes:** `/notifications`
- **Owned models:** `notification`
- **Publishes:** —
- **Consumes (target):** `post.liked`, `post.commented`, `job.application.submitted`, `job.application.status`

## Status: M2 — extracted (read path), shared-DB phase

The **read API** (`GET /notifications`, `GET /notifications/unread-count`,
`PATCH /notifications/:id/read`, `PATCH /notifications/read-all`) is served by
this service. The gateway routes `/notifications` here; everything else falls
through to the monolith.

During M2 this service reads the **same MongoDB `notifications` collection** the
monolith writes to (see docs/migration §6). The monolith's producers
(`posts.js`, `jobs.js`) still **create** notifications and emit the realtime
`notification:new` socket event — realtime ownership moves in M5, and the
write/event path is decoupled afterward.

## Local run
```bash
# Point MONGO_URI at the same DB as the monolith for the shared-DB phase.
cp .env.example .env
corepack pnpm --filter notification-service start
```

## Migration checklist
- [x] Port routes from the monolith into `src/routes/`.
- [x] Move owned Mongoose models into `src/models/` (+ minimal `User` for populate).
- [x] Flip the gateway route to this service (`NOTIFICATION_URL`).
- [x] Verify response-shape parity with the monolith.
- [ ] Remove the read routes from the monolith (final cutover, prod-affecting).
- [ ] Decouple writes: monolith publishes events; this service consumes via `@dc/events` and owns creation + realtime emit.
- [ ] Give the service its own database (M6).
- [ ] Add automated tests.
