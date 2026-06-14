import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/notifications).
// Owned models: notification.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'notification-service', status: 'stub' });
});

export default router;
