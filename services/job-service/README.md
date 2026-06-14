# job-service

Job board: postings and applications.

- **Port:** `4011`
- **Route prefixes:** `/jobs`
- **Owned models:** `jobPosting`, `jobApplication`
- **Reads (shared-DB phase):** `users`, writes `notifications`
- **Publishes (target):** `job.posted`, `job.application.submitted`, `job.application.status`

## Status: M3 — extracted, shared-DB phase

All `/jobs/*` routes are served here (gateway routes `/jobs` -> this service).
The 30s per-user listing cache uses `@dc/cache` (no-op without Redis).

Notifications for `job_application` / `job_application_status` are written
directly to the shared `notifications` collection (monolith parity); the
realtime `notification:new` socket emit moves to the realtime-gateway in M5.

## Local run
```bash
cp .env.example .env   # set MONGO_URI (shared)
corepack pnpm --filter job-service start
```

## Migration checklist
- [x] Port routes + models (jobPosting, jobApplication).
- [x] Port block-exclusion + skill-match logic; user-doc auth with tokenVersion.
- [x] Flip the gateway route to this service (`JOB_URL`).
- [ ] Remove `/jobs` routes from the monolith (final cutover).
- [ ] Publish events instead of writing notifications directly (decouple, M5).
- [ ] Own its database (M6); add tests.
