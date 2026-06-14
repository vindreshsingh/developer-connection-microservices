# post-service

Developer feed: posts, comments, likes.

- **Port:** `4009`
- **Route prefixes:** `/posts`
- **Owned models:** `post`, `postComment`
- **Publishes:** `post.created`, `post.liked`, `post.commented`
- **Consumes:** `profile.updated`

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
