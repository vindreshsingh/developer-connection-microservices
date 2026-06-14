# profile-service

**Status:** M6 complete — own database (`profile` / `profiles` collection).

Profile `_id` equals identity account `_id`. Created by identity-service on
signup/OAuth bootstrap. OAuth credentials stay in identity-service; this service
calls identity internal APIs for enrichment sync/disconnect and password changes.

## Routes (via gateway `/profile`, auth required)

Profile CRUD, feed, photo/cover uploads, GitHub/LinkedIn enrichment.

Feed exclusions come from connection-service (`GET /internal/feed-exclusions/:userId`).

## Env

See `.env.example`. Required: `MONGO_URI`, `IDENTITY_URL`, `CONNECTION_URL`,
`INTERNAL_SERVICE_TOKEN`, `JWT_SECRET`.

## Run

```bash
cp .env.example .env
pnpm --filter profile-service dev
```
