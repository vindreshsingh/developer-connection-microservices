import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/profile).
// Owned models: profile (keyed by userId).
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'profile-service', status: 'stub' });
});

export default router;
