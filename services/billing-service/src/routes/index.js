import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/billing).
// Owned models: subscription, plan, paymentEvent.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'billing-service', status: 'stub' });
});

export default router;
