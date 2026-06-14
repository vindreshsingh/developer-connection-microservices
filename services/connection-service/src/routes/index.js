import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/request).
// Owned models: connectionRequest, report.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'connection-service', status: 'stub' });
});

export default router;
