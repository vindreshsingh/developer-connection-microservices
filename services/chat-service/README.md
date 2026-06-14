# chat-service

Direct messaging conversations + message history (realtime via realtime-gateway).

- **Port:** `4004`
- **Route prefixes:** `/chat`
- **Owned models:** `conversation`, `message`
- **Publishes:** `message.sent`, `conversation.read`
- **Consumes:** `connection.accepted`

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
