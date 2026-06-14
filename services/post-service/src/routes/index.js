import { Router } from 'express';
import { requireUser } from '@dc/auth';

const router = Router();

// TODO: port handlers from the monolith (/posts).
// Owned models: post, postComment.
router.get('/', requireUser, (_req, res) => {
  res.json({ service: 'post-service', status: 'stub' });
});

export default router;
