# profile-service

**Status:** M6 — extracted (shared-DB phase). Owns the user's profile.

Mounted at `/profile`. All routes require auth (gateway edge auth + forwarded
`x-internal-user` / `x-internal-token-version`).

## Routes

- `GET /profile` (own), `PATCH /profile` (edit), `DELETE /profile` (soft-delete)
- `GET /profile/feed` — paginated discovery feed (skills / experience filters)
- `POST /profile/photo`, `POST /profile/cover` — multipart image uploads
- `GET /profile/linked-accounts`
- `POST /profile/github/sync`, `DELETE /profile/github/disconnect`
- `POST /profile/linkedin/sync`, `DELETE /profile/linkedin/disconnect`
- `GET /profile/:userId` — public profile (registered last)

## Owns (profile fields on the shared `users` doc)

`firstName`, `lastName`, `photoUrl`, `coverImageUrl`, `bio`, `skills`,
`techStack`, `experience`, `age`, `gender`, `github.*`, `linkedin.*`.

## Couplings (shared-DB phase — flagged for the M6 DB split)

- Reads `oauthProviders` (owned by identity-service) to decrypt access tokens
  for enrichment, and `password` existence to guard "disconnect only login".
- Reads `connectionrequests` (owned by connection-service) + others'
  `blockedUsers` to build the feed exclusion set.
- `ENCRYPTION_KEY` / `JWT_SECRET` must match identity-service + the monolith.

## Run locally

```bash
pnpm install
cp .env.example .env   # set MONGO_URI, JWT_SECRET, ENCRYPTION_KEY, CLOUDINARY_*
pnpm --filter profile-service dev
```

## Migration checklist

- [x] Profile CRUD + feed + uploads + enrichment ported
- [ ] Remove monolith `/profile` routes at cutover
- [ ] Split profile fields into a dedicated profile DB (consume `user.created`)
- [ ] Replace cross-context reads (oauthProviders, connectionrequests) with
      service calls / events
