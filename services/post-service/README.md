# post-service

Developer feed: posts, comments, likes.

- **Port:** `4009`
- **Route prefixes:** `/posts`
- **Owned models:** `post`, `postComment`
- **Reads (shared-DB phase):** `users`, `connectionrequests`, writes `notifications`
- **Publishes (target):** `post.created`, `post.liked`, `post.commented`

## Status: M3 — extracted, shared-DB phase

All `/posts/*` routes are served here (gateway routes `/posts` -> this service).
Image uploads go through `@dc/cloudinary`. The network-feed scope reads accepted
connections from the shared `connectionrequests` collection.

Notifications for `post_like` / `post_comment` are written directly to the
shared `notifications` collection (monolith parity); the realtime
`notification:new` socket emit moves to the realtime-gateway in M5.

## Local run
```bash
cp .env.example .env   # set MONGO_URI (shared), CLOUDINARY_*
corepack pnpm --filter post-service start
```

## Migration checklist
- [x] Port routes + models (post, postComment).
- [x] Port feed-scope + block-exclusion logic; user-doc auth with tokenVersion.
- [x] Flip the gateway route to this service (`POST_URL`).
- [ ] Remove `/posts` routes from the monolith (final cutover).
- [ ] Publish events instead of writing notifications directly (decouple, M5).
- [ ] Read connections via connection-service API/events; own its database (M6).
- [ ] Add tests.
