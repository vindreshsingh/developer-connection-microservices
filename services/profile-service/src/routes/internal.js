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

router.get('/profiles/search', async (req, res) => {
  try {
    const exclude = (req.query.exclude || '')
      .split(',')
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const select = req.query.fields || undefined;

    let query = Profile.find({ _id: { $nin: exclude } });
    if (select) query = query.select(select);
    const profiles = await query.limit(limit);
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/profiles/batch', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds array required' });

    const ids = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const profiles = await Profile.find({ _id: { $in: ids } }).select(
      'firstName lastName photoUrl bio skills',
    );
    res.json({ profiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/profiles/:userId/premium', async (req, res) => {
  const { isPremium } = req.body;
  if (typeof isPremium !== 'boolean') return res.status(400).json({ error: 'isPremium boolean required' });

  const profile = await Profile.findByIdAndUpdate(
    req.params.userId,
    { isPremium },
    { new: true },
  );
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ ok: true, isPremium: profile.isPremium });
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
