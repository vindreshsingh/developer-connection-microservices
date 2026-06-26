/**
 * Groups REST API — ported from the monolith (backend/src/routes/groups.js).
 * Mounted at /groups. Owns groups + group messages (CRUD, membership, history).
 *
 * Realtime group chat/typing and group-call signaling live in the
 * realtime-gateway.
 *
 * NOTE (shared-DB phase): reads `users` to validate invited members — a
 * cross-context read to be replaced by a profile-service API in M6.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import Group from '../models/group.js';
import GroupMessage from '../models/groupMessage.js';
import { getProfile } from '@dc/service-clients';

const router = Router();
const PAGE_SIZE = 20;
const MSG_PAGE_SIZE = 50;

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const requireMember = async (req, res, next) => {
  const { groupId } = req.params;
  if (!validObjectId(groupId)) return res.status(400).json({ error: 'Invalid group ID.' });

  const group = await Group.findOne({ _id: groupId, deletedAt: null });
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  const member = group.getMember(req.user._id);
  if (!member) return res.status(403).json({ error: 'You are not a member of this group.' });

  req.group = group;
  req.memberRole = member.role;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.memberRole !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

// POST /groups — create a group
router.post('/', userAuth, async (req, res) => {
  try {
    const { name, description, tags } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required.' });

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() ?? '',
      tags: Array.isArray(tags) ? tags.map((t) => t.toLowerCase().trim()) : [],
      createdBy: req.user._id,
      members: [{ userId: req.user._id, role: 'admin', joinedAt: new Date() }],
      memberCount: 1,
    });

    res.status(201).json({ message: 'Group created.', group });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /groups — list public groups
router.get('/', userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const filter = { deletedAt: null };
    const { tags } = req.query;
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tagList.length) filter.tags = { $in: tagList };
    }

    const total = await Group.countDocuments(filter);
    const groups = await Group.find(filter)
      .sort({ memberCount: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .select('name description tags memberCount maxMembers createdBy createdAt');

    res.status(200).json({
      data: groups,
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

// GET /groups/:groupId — group detail
router.get('/:groupId', userAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!validObjectId(groupId)) return res.status(400).json({ error: 'Invalid group ID.' });

    const group = await Group.findOne({ _id: groupId, deletedAt: null })
      .populate('members.userId', 'firstName lastName photoUrl');

    if (!group) return res.status(404).json({ error: 'Group not found.' });

    const recentMessageCount = await GroupMessage.countDocuments({ groupId });

    res.status(200).json({ group, recentMessageCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /groups/:groupId/join
router.post('/:groupId/join', userAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!validObjectId(groupId)) return res.status(400).json({ error: 'Invalid group ID.' });

    const group = await Group.findOne({ _id: groupId, deletedAt: null });
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    if (group.getMember(req.user._id))
      return res.status(400).json({ error: 'You are already a member of this group.' });

    if (group.memberCount >= group.maxMembers)
      return res.status(400).json({ error: `This group is full (max ${group.maxMembers} members).` });

    group.members.push({ userId: req.user._id, role: 'member', joinedAt: new Date() });
    group.memberCount += 1;
    await group.save();

    res.status(200).json({ message: 'Joined group.', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /groups/:groupId/leave
router.delete('/:groupId/leave', userAuth, requireMember, async (req, res) => {
  try {
    const { group } = req;
    const userId = req.user._id;

    if (req.memberRole === 'admin') {
      const admins = group.members.filter((m) => m.role === 'admin');
      if (admins.length === 1) {
        return res.status(400).json({
          error: 'You are the sole admin. Transfer ownership to another member before leaving.',
        });
      }
    }

    group.members = group.members.filter((m) => !m.userId.equals(userId));
    group.memberCount = Math.max(1, group.memberCount - 1);
    await group.save();

    res.status(200).json({ message: 'Left group.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /groups/:groupId/members/:userId — admin invite
router.post('/:groupId/members/:userId', userAuth, requireMember, requireAdmin, async (req, res) => {
  try {
    const { group } = req;
    const { userId } = req.params;

    if (!validObjectId(userId)) return res.status(400).json({ error: 'Invalid user ID.' });

    if (group.getMember(userId))
      return res.status(400).json({ error: 'User is already a member of this group.' });

    if (group.memberCount >= group.maxMembers)
      return res.status(400).json({ error: `This group is full (max ${group.maxMembers} members).` });

    const target = await getProfile(userId);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    group.members.push({ userId: target._id, role: 'member', joinedAt: new Date() });
    group.memberCount += 1;
    await group.save();

    res.status(200).json({ message: 'Member added.', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /groups/:groupId/members/:userId — admin remove
router.delete('/:groupId/members/:userId', userAuth, requireMember, requireAdmin, async (req, res) => {
  try {
    const { group } = req;
    const { userId } = req.params;

    if (!validObjectId(userId)) return res.status(400).json({ error: 'Invalid user ID.' });

    if (String(req.user._id) === String(userId))
      return res.status(400).json({ error: 'Use the leave endpoint to remove yourself.' });

    if (!group.getMember(userId))
      return res.status(404).json({ error: 'User is not a member of this group.' });

    group.members = group.members.filter((m) => !m.userId.equals(userId));
    group.memberCount = Math.max(1, group.memberCount - 1);
    await group.save();

    res.status(200).json({ message: 'Member removed.', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /groups/:groupId — admin update
router.patch('/:groupId', userAuth, requireMember, requireAdmin, async (req, res) => {
  try {
    const ALLOWED = ['name', 'description', 'tags'];
    const invalid = Object.keys(req.body).filter((k) => !ALLOWED.includes(k));
    if (invalid.length) return res.status(400).json({ error: `Invalid fields: ${invalid.join(', ')}` });

    const { name, description, tags } = req.body;
    if (name !== undefined) req.group.name = name.trim();
    if (description !== undefined) req.group.description = description.trim();
    if (tags !== undefined)
      req.group.tags = Array.isArray(tags) ? tags.map((t) => t.toLowerCase().trim()) : [];

    await req.group.save();
    res.status(200).json({ message: 'Group updated.', group: req.group });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /groups/:groupId — admin soft-delete
router.delete('/:groupId', userAuth, requireMember, requireAdmin, async (req, res) => {
  try {
    req.group.deletedAt = new Date();
    await req.group.save();
    res.status(200).json({ message: 'Group deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /groups/:groupId/messages — paginated history
router.get('/:groupId/messages', userAuth, requireMember, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { before } = req.query;

    const filter = { groupId };
    if (before) filter.createdAt = { $lt: new Date(before) };

    const messages = await GroupMessage.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(MSG_PAGE_SIZE)
      .populate('senderId', 'firstName lastName photoUrl');

    res.status(200).json({ messages: messages.reverse(), hasMore: messages.length === MSG_PAGE_SIZE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
