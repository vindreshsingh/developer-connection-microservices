import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/auth).
// Owned models: user (auth fields).
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'identity-service', status: 'stub' });
});

export default router;
