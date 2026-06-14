# identity-service

Account system-of-record: signup, login, JWT issuance, OAuth, password reset, email verification.

- **Port:** `4001`
- **Route prefixes:** `/auth`
- **Owned models:** `user (auth fields)`
- **Publishes:** `user.registered`, `user.deleted`
- **Consumes:** —

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
