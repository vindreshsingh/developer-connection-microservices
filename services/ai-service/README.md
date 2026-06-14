# ai-service

AI match recommendations, resume feedback, mock interviews.

- **Port:** `4008`
- **Route prefixes:** `/ai`
- **Owned models:** `aiUsageLog`, `resumeFeedback`, `interviewSession`, `recommendationCache`
- **Publishes:** `recommendations.generated`
- **Consumes:** `profile.updated`, `connection.accepted`

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
