import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/groups).
// Owned models: group, groupMessage.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'group-service', status: 'stub' });
});

export default router;
