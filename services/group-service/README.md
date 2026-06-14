# group-service

Groups and group messaging.

- **Port:** `4005`
- **Route prefixes:** `/groups`
- **Owned models:** `group`, `groupMessage`
- **Publishes:** `group.message.sent`, `group.member.joined`
- **Consumes:** —

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
