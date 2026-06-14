import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/jobs).
// Owned models: jobPosting, jobApplication.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'job-service', status: 'stub' });
});

export default router;
