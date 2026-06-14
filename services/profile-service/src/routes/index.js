import { Router } from 'express';
import profileRoutes from './profile.js';

const router = Router();
router.use('/', profileRoutes);

export default router;
