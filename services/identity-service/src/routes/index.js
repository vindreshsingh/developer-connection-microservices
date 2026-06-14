import { Router } from 'express';
import authRoutes from './auth.js';
import oauthRoutes from './oauth.js';
import internalRoutes from './internal.js';

const router = Router();

router.use('/internal', internalRoutes);
router.use('/', oauthRoutes);
router.use('/', authRoutes);

export default router;
