# identity-service

**Status:** M6 complete — own database (`identity` / `accounts` collection).

Account authority: credentials, OAuth, JWT issuance. Profile fields live in
profile-service (`profile` DB). On signup/OAuth, identity bootstraps the profile
via `POST profile-service/internal/profiles`.

## Routes (public, via gateway `/auth`)

- `POST /auth/signup`, `/login`, `/logout`, password reset, email verify
- `GET /auth/oauth/:provider[/callback]`

## Internal routes (`/auth/internal/*`, service token only)

Session validation, OAuth token decrypt, linked-accounts, disconnect, password
update, account deactivate — called by profile-service.

## Env

See `.env.example`. Required: `MONGO_URI`, `JWT_SECRET`, `PROFILE_URL`,
`INTERNAL_SERVICE_TOKEN`, `ENCRYPTION_KEY` (for OAuth).

## Run

```bash
cp .env.example .env
pnpm --filter identity-service dev
# With Redis: pnpm --filter identity-service worker:dev
```
