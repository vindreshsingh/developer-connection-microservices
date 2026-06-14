# billing-service

Plans, Razorpay checkout/subscription lifecycle, payment history, webhooks.

- **Port:** `4007`
- **Route prefixes:** `/billing`
- **Owned models:** `plan`, `subscription`, `paymentEvent`
- **Writes (shared-DB phase):** `users.isPremium` (cross-context, decouple in M6)
- **Publishes (target):** `billing.subscription.activated|cancelled|expired`, `payment.succeeded|failed`

## Status: M4 — extracted, shared-DB phase

All `/billing/*` routes are served here (gateway routes `/billing` -> this
service). `GET /billing/plans` is public; everything else needs auth except the
webhook (Razorpay signature).

**Webhook integrity:** `POST /billing/webhook` is parsed with `express.raw` so
the HMAC-SHA256 signature verifies against the exact bytes. The gateway never
parses request bodies, so the signed bytes pass through unchanged.

**Idempotency:** webhook redelivery is a no-op — the route dedupes by
`PaymentEvent.razorpayEventId` before `BillingEventHandler.handle`, and the
state transitions are themselves idempotent (safe consumer pattern). A durable
outbox + published events is the M6 follow-up.

## Local run
```bash
cp .env.example .env   # set MONGO_URI (shared), RAZORPAY_*
corepack pnpm --filter billing-service start
```

## Migration checklist
- [x] Port routes, models, PaymentService, BillingEventHandler.
- [x] Raw-body webhook handling preserved end-to-end through the gateway.
- [x] Flip the gateway route to this service (`BILLING_URL`).
- [ ] Remove `/billing` routes from the monolith (final cutover).
- [ ] Publish `billing.*` events; stop writing `users.isPremium` directly (M6).
- [ ] Own its database; add tests.
