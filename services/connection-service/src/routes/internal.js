import { Router } from 'express';
import mongoose from 'mongoose';
import { requireServiceToken } from '@dc/auth';
import ConnectionRequest from '../models/connectionRequest.js';
import User from '../models/user.js';

const router = Router();

router.use(requireServiceToken);

// User IDs to exclude from profile-service discovery feed for a given user.
router.get('/feed-exclusions/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const uid = new mongoose.Types.ObjectId(userId);
  const excludedIds = new Set([userId]);

  const interactions = await ConnectionRequest.find({
    $or: [{ fromUserId: uid }, { toUserId: uid }],
  }).select('fromUserId toUserId');

  for (const r of interactions) {
    excludedIds.add(r.fromUserId.toString());
    excludedIds.add(r.toUserId.toString());
  }

  const user = await User.findById(uid).select('blockedUsers');
  if (user) {
    for (const id of user.blockedUsers) excludedIds.add(id.toString());
    const blockedByOthers = await User.find({ blockedUsers: uid }).select('_id');
    for (const u of blockedByOthers) excludedIds.add(u._id.toString());
  }

  res.json({ excludedIds: [...excludedIds] });
});

router.get('/block-context/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const uid = new mongoose.Types.ObjectId(userId);
  let user = await User.findById(uid).select('blockedUsers');
  if (!user) user = { blockedUsers: [] };

  const blockedBy = await User.find({ blockedUsers: uid }).select('_id');
  res.json({
    blockedUsers: user.blockedUsers.map((id) => id.toString()),
    blockedBy: blockedBy.map((u) => u._id.toString()),
  });
});

export default router;
