/**
 * Profile REST API — ported from the monolith (backend/src/routes/profile.js).
 * Mounted under /profile. Owns the user's profile fields, discovery feed,
 * image uploads, and GitHub/LinkedIn enrichment.
 */

import mongoose from 'mongoose';
import { Router } from 'express';
import multer from 'multer';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import userAuth from '../middlewares/auth.js';
import { uploadImageBuffer } from '@dc/cloudinary';
import { GitHubEnrichmentService } from '../lib/githubEnrichment.js';
import { LinkedInEnrichmentService } from '../lib/linkedinEnrichment.js';
import { decryptToken } from '../lib/encryption.js';

const router = Router();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const handleImageUpload = (field, folder) => [
  userAuth,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided' });

      const result = await uploadImageBuffer(req.file.buffer, folder);
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { [field]: result.secure_url },
        { new: true, runValidators: true },
      );

      res.status(200).json({ message: 'Image uploaded successfully', user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
];

const ALLOWED_UPDATES = [
  'firstName',
  'lastName',
  'password',
  'photoUrl',
  'coverImageUrl',
  'bio',
  'skills',
  'techStack',
  'experience',
  'githubUrl',
  'linkedinUrl',
  'age',
  'gender',
];

router.get('/', userAuth, (req, res) => {
  res.status(200).json(req.user);
});

router.patch('/', userAuth, async (req, res) => {
  try {
    const invalidFields = Object.keys(req.body).filter((k) => !ALLOWED_UPDATES.includes(k));
    if (invalidFields.length > 0)
      return res.status(400).json({ error: `Invalid fields: ${invalidFields.join(', ')}` });

    const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true });
    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/', userAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false, deletedAt: new Date() });
    res.clearCookie('token');
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/photo', ...handleImageUpload('photoUrl', 'profile-photos'));
router.post('/cover', ...handleImageUpload('coverImageUrl', 'cover-images'));

const FEED_PAGE_SIZE = 20;
const PUBLIC_PROFILE_FIELDS =
  'firstName lastName photoUrl bio skills githubUrl linkedinUrl age gender ' +
  'github.username github.profileUrl github.topRepos github.topLanguages ' +
  'linkedin.headline linkedin.company linkedin.jobTitle linkedin.profileUrl';

// FEED must be registered before VIEW_BY_ID ('/:userId') — otherwise Express
// matches "/profile/feed" as VIEW_BY_ID with userId="feed".
router.get('/feed', userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const loggedInUserId = req.user._id;

    const interactions = await ConnectionRequest.find({
      $or: [{ fromUserId: loggedInUserId }, { toUserId: loggedInUserId }],
    }).select('fromUserId toUserId');

    const excludedIds = new Set([loggedInUserId.toString()]);
    for (const r of interactions) {
      excludedIds.add(r.fromUserId.toString());
      excludedIds.add(r.toUserId.toString());
    }

    for (const id of req.user.blockedUsers) excludedIds.add(id.toString());
    const blockedByOthers = await User.find({ blockedUsers: loggedInUserId }).select('_id');
    for (const u of blockedByOthers) excludedIds.add(u._id.toString());

    const filter = { _id: { $nin: [...excludedIds] } };

    const { skills } = req.query;
    if (skills) {
      const skillList = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (skillList.length > 0) {
        filter.skills = { $in: skillList.map((s) => new RegExp(`^${s}$`, 'i')) };
      }
    }

    const { experienceLevel } = req.query;
    if (experienceLevel && req.user.isPremium) {
      const ranges = {
        junior: { $lt: 2 },
        mid: { $gte: 2, $lt: 5 },
        senior: { $gte: 5 },
      };
      const range = ranges[experienceLevel];
      if (range) {
        filter.$expr = {
          $let: {
            vars: {
              totalYears: {
                $reduce: {
                  input: '$experience',
                  initialValue: 0,
                  in: {
                    $add: [
                      '$$value',
                      {
                        $divide: [
                          { $subtract: [{ $ifNull: ['$$this.endDate', '$$NOW'] }, '$$this.startDate'] },
                          1000 * 60 * 60 * 24 * 365,
                        ],
                      },
                    ],
                  },
                },
              },
            },
            in: { $and: Object.entries(range).map(([op, val]) => ({ [op]: ['$$totalYears', val] })) },
          },
        };
      }
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select(PUBLIC_PROFILE_FIELDS)
      .skip((page - 1) * FEED_PAGE_SIZE)
      .limit(FEED_PAGE_SIZE);

    res.status(200).json({
      data: users,
      pagination: {
        page,
        pageSize: FEED_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / FEED_PAGE_SIZE),
        hasNextPage: page * FEED_PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Linked accounts + enrichment — all before /:userId ────────────────────────

router.get('/linked-accounts', userAuth, (req, res) => {
  const linked = (req.user.oauthProviders || []).map((p) => ({
    provider: p.provider,
    linkedAt: p.linkedAt,
  }));
  res.status(200).json({ linkedAccounts: linked });
});

router.post('/github/sync', userAuth, async (req, res) => {
  try {
    const user = req.user;
    const provider = user.oauthProviders?.find((p) => p.provider === 'github');

    if (!provider) return res.status(400).json({ error: 'GitHub account is not linked to your profile.' });

    const plainToken = decryptToken(provider.accessToken);
    const svc = new GitHubEnrichmentService(plainToken);
    const data = await svc.sync();

    user.github = data;
    await user.save();

    res.status(200).json({ message: 'GitHub profile synced.', github: user.github });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/github/disconnect', userAuth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.oauthProviders?.some((p) => p.provider === 'github'))
      return res.status(400).json({ error: 'GitHub account is not linked to your profile.' });

    const otherProviders = user.oauthProviders.filter((p) => p.provider !== 'github');
    const hasPassword = await User.exists({ _id: user._id, password: { $ne: null } });
    if (!hasPassword && otherProviders.length === 0) {
      return res.status(400).json({ error: 'Cannot disconnect your only login method. Set a password first.' });
    }

    user.oauthProviders = otherProviders;
    user.github = undefined;
    await user.save();

    res.status(200).json({ message: 'GitHub account disconnected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/linkedin/sync', userAuth, async (req, res) => {
  try {
    const user = req.user;
    const provider = user.oauthProviders?.find((p) => p.provider === 'linkedin');

    if (!provider) return res.status(400).json({ error: 'LinkedIn account is not linked to your profile.' });

    const plainToken = decryptToken(provider.accessToken);
    const svc = new LinkedInEnrichmentService(plainToken);
    const data = await svc.sync();

    user.linkedin = data;
    await user.save();

    res.status(200).json({ message: 'LinkedIn profile synced.', linkedin: user.linkedin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/linkedin/disconnect', userAuth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.oauthProviders?.some((p) => p.provider === 'linkedin'))
      return res.status(400).json({ error: 'LinkedIn account is not linked to your profile.' });

    const otherProviders = user.oauthProviders.filter((p) => p.provider !== 'linkedin');
    const hasPassword = await User.exists({ _id: user._id, password: { $ne: null } });
    if (!hasPassword && otherProviders.length === 0) {
      return res.status(400).json({ error: 'Cannot disconnect your only login method. Set a password first.' });
    }

    user.oauthProviders = otherProviders;
    user.linkedin = undefined;
    await user.save();

    res.status(200).json({ message: 'LinkedIn account disconnected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public profile by ID — MUST be last ───────────────────────────────────────
router.get('/:userId', userAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });

    const user = await User.findById(userId).select(PUBLIC_PROFILE_FIELDS);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
