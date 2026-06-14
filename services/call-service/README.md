# call-service

1:1 and group video calls (LiveKit tokens + signaling).

- **Port:** `4006`
- **Route prefixes:** `/calls`
- **Owned models:** `callSession`
- **Publishes:** `call.initiated`, `call.ended`
- **Consumes:** —

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
