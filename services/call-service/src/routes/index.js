import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/calls).
// Owned models: callSession.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'call-service', status: 'stub' });
});

export default router;
