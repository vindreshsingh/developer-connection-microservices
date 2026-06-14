# notification-service

Notification storage + fan-out (consumes domain events from every service).

- **Port:** `4010`
- **Route prefixes:** `/notifications`
- **Owned models:** `notification`
- **Publishes:** —
- **Consumes:** `connection.requested`, `connection.accepted`, `message.sent`, `post.liked`, `post.commented`, `payment.succeeded`, `call.initiated`

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
