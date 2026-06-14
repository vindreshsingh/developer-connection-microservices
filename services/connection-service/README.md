# connection-service

Connection requests, blocking, reporting.

- **Port:** `4003`
- **Route prefixes:** `/request`
- **Owned models:** `connectionRequest`, `report`
- **Publishes:** `connection.accepted`, `connection.requested`, `user.blocked`
- **Consumes:** `profile.updated`

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
