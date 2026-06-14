# identity-service

**Status:** M6 — extracted (shared-DB phase). The account/credentials authority.

Mounted at `/auth`. Owns authentication and is the **only** service that mints
the JWT. Public endpoints (no edge auth) — they set/clear the `token` cookie.

## Routes

- `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`
- `POST /auth/forgot-password`, `POST /auth/reset-password/:token`
- `GET  /auth/verify-email/:token`, `POST /auth/resend-verification`
- `GET  /auth/oauth/:provider`, `GET /auth/oauth/:provider/callback` (github / google / linkedin)

## Owns (identity fields on the shared `users` doc)

`email`, `password`, `isEmailVerified`, `emailVerify*`, `passwordReset*`,
`tokenVersion`, `oauthProviders`. Issues the JWT (`getJWT`) and bumps
`tokenVersion` on password reset (logout-everywhere).

## Notes / couplings (shared-DB phase)

- Signup currently writes the **whole** `users` document (profile fields too) —
  the identity/profile field split is the later M6 DB-split step.
- Transactional email uses the shared `email` BullMQ queue when `REDIS_URL` is
  set — drained by `identity-worker` (`pnpm worker` / `pnpm worker:dev`); otherwise
  sends inline during the request.
- `ENCRYPTION_KEY` + `JWT_SECRET` must match the monolith for token parity.
- `OAUTH_CALLBACK_BASE_URL` must be the public gateway origin.

## Run locally

```bash
pnpm install
cp .env.example .env   # set MONGO_URI, JWT_SECRET, ENCRYPTION_KEY (+ OAuth/SMTP as needed)
pnpm --filter identity-service dev
```

## Migration checklist

- [x] Auth + OAuth + email flows ported; JWT issuance owned here
- [ ] Remove monolith `/auth` routes at cutover
- [ ] Split identity fields into a dedicated identity DB (dual-write + backfill)
- [ ] Publish `user.created` / `user.deleted` events for profile-service
