import { Router } from 'express';
import mongoose from 'mongoose';
import { requireUser } from '@dc/auth';
import { getProfilesBatch } from '@dc/service-clients';
import Notification from '../models/notification.js';

const router = Router();
const PAGE_SIZE = 20;

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const attachActors = async (notifications) => {
  const actorIds = [...new Set(notifications.map((n) => n.actorId && String(n.actorId)).filter(Boolean))];
  const profiles = await getProfilesBatch(actorIds);
  const byId = new Map(profiles.map((p) => [String(p._id), p]));
  return notifications.map((n) => {
    const doc = n.toObject ? n.toObject() : n;
    if (doc.actorId) doc.actorId = byId.get(String(doc.actorId)) || doc.actorId;
    return doc;
  });
};

router.get('/', requireUser, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { recipientId: req.userId };

    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE);

    const data = await attachActors(notifications);

    res.status(200).json({
      data,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasNextPage: page * PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', requireUser, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipientId: req.userId, read: false });
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', requireUser, async (req, res) => {
  try {
    await Notification.updateMany({ recipientId: req.userId, read: false }, { read: true });
    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:notificationId/read', requireUser, async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!validObjectId(notificationId))
      return res.status(404).json({ error: 'Notification not found.' });

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: req.userId },
      { read: true },
      { new: true },
    );

    if (!notification) return res.status(404).json({ error: 'Notification not found.' });

    res.status(200).json({ notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
