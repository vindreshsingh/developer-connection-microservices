import { Router } from 'express';
import mongoose from 'mongoose';
import { requireServiceToken } from '@dc/auth';
import Profile from '../models/profile.js';

const router = Router();

router.use(requireServiceToken);

router.post('/profiles', async (req, res) => {
  try {
    const { userId, ...fields } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Valid userId is required' });
    }

    const existing = await Profile.findById(userId);
    if (existing) return res.status(409).json({ error: 'Profile already exists' });

    if (!fields.firstName) fields.firstName = 'User';

    const profile = await Profile.create({ _id: userId, ...fields });
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/profiles/:userId', async (req, res) => {
  const profile = await Profile.findById(req.params.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

router.post('/profiles/:userId/deactivate', async (req, res) => {
  const profile = await Profile.findById(req.params.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  profile.isActive = false;
  profile.deletedAt = new Date();
  await profile.save();
  res.json({ ok: true });
});

export default router;
