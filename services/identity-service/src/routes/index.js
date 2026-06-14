import { Router } from 'express';
import authRoutes from './auth.js';
import oauthRoutes from './oauth.js';

const router = Router();

// OAuth routes first (both mounted under /auth); paths don't collide
// (/oauth/:provider vs /signup, /login, ...).
router.use('/', oauthRoutes);
router.use('/', authRoutes);

export default router;
