/**
 * Connections REST API — ported from the monolith (backend/src/routes/connection.js).
 * Mounted at /request. Owns connection requests, blocking, and reports.
 *
 * NOTE (shared-DB phase): block/unblock writes `users.blockedUsers` and the
 * swipe cap reads billing's `Plan` — cross-context reads/writes to be decoupled
 * via profile-service / billing-service APIs (or events) in M6.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { swipeRateLimiter } from '@dc/ratelimiter';
import ConnectionRequest from '../models/connectionRequest.js';
import Report from '../models/report.js';
import User from '../models/user.js';
import Plan from '../models/plan.js';

const router = Router();

// POST /request/send/:status/:toUserId
router.post('/send/:status/:toUserId', userAuth, swipeRateLimiter, async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const { status, toUserId } = req.params;

    const ALLOWED_STATUS = ['interested', 'ignored'];
    if (!ALLOWED_STATUS.includes(status))
      return res.status(400).json({ error: 'Invalid status. Use interested or ignored' });

    if (!mongoose.Types.ObjectId.isValid(toUserId))
      return res.status(400).json({ error: 'Invalid user id' });

    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ error: 'User not found' });

    const existingRequest = await ConnectionRequest.findOne({
      $or: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    });
    if (existingRequest) return res.status(400).json({ error: 'Connection request already exists' });

    if (status === 'interested' && !req.user.isPremium) {
      const freePlan = await Plan.findOne({ key: 'free' });
      const dailySwipeLimit = freePlan?.features?.dailySwipeLimit;

      if (typeof dailySwipeLimit === 'number') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const sentToday = await ConnectionRequest.countDocuments({
          fromUserId,
          status: 'interested',
          createdAt: { $gte: startOfDay },
        });

        if (sentToday >= dailySwipeLimit) return res.status(403).json({ error: 'SWIPE_LIMIT_REACHED' });
      }
    }

    const request = new ConnectionRequest({ fromUserId, toUserId, status });
    await request.save();

    res.status(201).json({ message: `Request ${status} sent to ${toUser.firstName}`, request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /request/review/:status/:requestId
router.post('/review/:status/:requestId', userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const { status, requestId } = req.params;

    const ALLOWED_STATUS = ['accepted', 'rejected'];
    if (!ALLOWED_STATUS.includes(status))
      return res.status(400).json({ error: 'Invalid status. Use accepted or rejected' });

    if (!mongoose.Types.ObjectId.isValid(requestId))
      return res.status(400).json({ error: 'Invalid request id' });

    const connectionRequest = await ConnectionRequest.findOne({
      _id: requestId,
      toUserId: loggedInUser,
      status: 'interested',
    });

    if (!connectionRequest) return res.status(404).json({ error: 'Connection request not found' });

    connectionRequest.status = status;
    await connectionRequest.save();

    res.status(200).json({ message: `Request ${status}`, connectionRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /request/pending
router.get('/pending', userAuth, async (req, res) => {
  try {
    const pendingRequests = await ConnectionRequest.find({
      toUserId: req.user._id,
      status: 'interested',
    }).populate('fromUserId', 'firstName lastName photoUrl bio skills');

    res.status(200).json({ count: pendingRequests.length, data: pendingRequests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /request/sent
router.get('/sent', userAuth, async (req, res) => {
  try {
    const sentRequests = await ConnectionRequest.find({
      fromUserId: req.user._id,
    }).populate('toUserId', 'firstName lastName photoUrl bio skills');

    res.status(200).json({ count: sentRequests.length, data: sentRequests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /request/connections
router.get('/connections', userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;

    const connections = await ConnectionRequest.find({
      $or: [
        { fromUserId: loggedInUser, status: 'accepted' },
        { toUserId: loggedInUser, status: 'accepted' },
      ],
    })
      .populate('fromUserId', 'firstName lastName photoUrl bio skills')
      .populate('toUserId', 'firstName lastName photoUrl bio skills');

    const data = connections.map((conn) =>
      conn.fromUserId._id.equals(loggedInUser) ? conn.toUserId : conn.fromUserId,
    );

    res.status(200).json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /request/blocked
router.get('/blocked', userAuth, async (req, res) => {
  try {
    await req.user.populate('blockedUsers', 'firstName lastName photoUrl bio skills');
    const data = req.user.blockedUsers.filter(Boolean);
    res.status(200).json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /request/block/:userId
router.post('/block/:userId', userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });
    if (loggedInUser._id.equals(userId))
      return res.status(400).json({ error: 'Cannot block yourself' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (!loggedInUser.blockedUsers.some((id) => id.equals(userId))) {
      loggedInUser.blockedUsers.push(userId);
      await loggedInUser.save();
    }

    await ConnectionRequest.deleteMany({
      $or: [
        { fromUserId: loggedInUser._id, toUserId: userId },
        { fromUserId: userId, toUserId: loggedInUser._id },
      ],
    });

    res.status(200).json({ message: `${targetUser.firstName} has been blocked` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /request/block/:userId
router.delete('/block/:userId', userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });

    loggedInUser.blockedUsers = loggedInUser.blockedUsers.filter((id) => !id.equals(userId));
    await loggedInUser.save();

    res.status(200).json({ message: 'User unblocked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /request/report/:userId
router.post('/report/:userId', userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const { userId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });
    if (!reason || !reason.trim())
      return res.status(400).json({ error: 'A reason is required to file a report' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const report = new Report({ reporterId: loggedInUser, reportedUserId: userId, reason: reason.trim() });
    await report.save();

    res.status(201).json({ message: `${targetUser.firstName} has been reported`, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
