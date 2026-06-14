# profile-service

Public profiles, photos, GitHub/LinkedIn enrichment, discovery feed.

- **Port:** `4002`
- **Route prefixes:** `/profile`
- **Owned models:** `profile (keyed by userId)`
- **Publishes:** `profile.updated`
- **Consumes:** `user.registered`, `user.deleted`

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
