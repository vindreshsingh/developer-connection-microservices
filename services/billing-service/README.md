# billing-service

Razorpay subscriptions, plans, webhooks, payment history.

- **Port:** `4007`
- **Route prefixes:** `/billing`
- **Owned models:** `subscription`, `plan`, `paymentEvent`
- **Publishes:** `payment.succeeded`, `subscription.updated`
- **Consumes:** —

## Migration checklist
- [ ] Port routes from the monolith into `src/routes/`.
- [ ] Move owned Mongoose models into `src/models/`.
- [ ] Publish/consume events via `@dc/events`.
- [ ] Add tests.
- [ ] Flip the gateway route to this service.
- [ ] Remove the route from the monolith.
