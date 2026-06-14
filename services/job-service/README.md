# job-service

Job board: postings and applications.

- **Port:** `4011`
- **Route prefixes:** `/jobs`
- **Owned models:** `jobPosting`, `jobApplication`
- **Publishes:** `job.posted`, `job.application.submitted`
- **Consumes:** —

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
