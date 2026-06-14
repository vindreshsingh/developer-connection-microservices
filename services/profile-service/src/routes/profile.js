/**
 * Profile REST API — profile fields only (profile DB).
 * OAuth credentials live in identity-service; blocking data in connection-service.
 */

import mongoose from 'mongoose';
import { Router } from 'express';
import multer from 'multer';
import Profile from '../models/profile.js';
import userAuth from '../middlewares/auth.js';
import { uploadImageBuffer } from '@dc/cloudinary';
import { GitHubEnrichmentService } from '../lib/githubEnrichment.js';
import { LinkedInEnrichmentService } from '../lib/linkedinEnrichment.js';
import {
  deactivateAccount,
  disconnectOAuth,
  getLinkedAccounts,
  getOAuthToken,
  updatePassword,
} from '../lib/identityClient.js';
import { getFeedExclusions } from '../lib/connectionClient.js';

const router = Router();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
      const profile = await Profile.findByIdAndUpdate(
        req.user._id,
        { [field]: result.secure_url },
        { new: true, runValidators: true },
      );

      res.status(200).json({ message: 'Image uploaded successfully', user: profile });
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

    const updates = { ...req.body };

    if (updates.password !== undefined) {
      if (!updates.password || updates.password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      await updatePassword(req.user._id, updates.password);
      delete updates.password;
    }

    const profile = await Profile.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ message: 'Profile updated successfully', user: profile });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.delete('/', userAuth, async (req, res) => {
  try {
    await Profile.findByIdAndUpdate(req.user._id, { isActive: false, deletedAt: new Date() });
    await deactivateAccount(req.user._id);
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

router.get('/feed', userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const loggedInUserId = req.user._id;

    const excludedIds = await getFeedExclusions(loggedInUserId);
    const filter = { _id: { $nin: excludedIds } };

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
      const ranges = { junior: { $lt: 2 }, mid: { $gte: 2, $lt: 5 }, senior: { $gte: 5 } };
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

    const total = await Profile.countDocuments(filter);
    const users = await Profile.find(filter)
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

router.get('/linked-accounts', userAuth, async (req, res) => {
  try {
    const data = await getLinkedAccounts(req.user._id);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/github/sync', userAuth, async (req, res) => {
  try {
    const tokenData = await getOAuthToken(req.user._id, 'github');
    if (!tokenData) return res.status(400).json({ error: 'GitHub account is not linked to your profile.' });

    const svc = new GitHubEnrichmentService(tokenData.accessToken);
    const data = await svc.sync();

    const profile = await Profile.findByIdAndUpdate(req.user._id, { github: data }, { new: true });
    res.status(200).json({ message: 'GitHub profile synced.', github: profile.github });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/github/disconnect', userAuth, async (req, res) => {
  try {
    await disconnectOAuth(req.user._id, 'github');
    const profile = await Profile.findByIdAndUpdate(req.user._id, { $unset: { github: 1 } }, { new: true });
    res.status(200).json({ message: 'GitHub account disconnected.', user: profile });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/linkedin/sync', userAuth, async (req, res) => {
  try {
    const tokenData = await getOAuthToken(req.user._id, 'linkedin');
    if (!tokenData) return res.status(400).json({ error: 'LinkedIn account is not linked to your profile.' });

    const svc = new LinkedInEnrichmentService(tokenData.accessToken);
    const data = await svc.sync();

    const profile = await Profile.findByIdAndUpdate(req.user._id, { linkedin: data }, { new: true });
    res.status(200).json({ message: 'LinkedIn profile synced.', linkedin: profile.linkedin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/linkedin/disconnect', userAuth, async (req, res) => {
  try {
    await disconnectOAuth(req.user._id, 'linkedin');
    const profile = await Profile.findByIdAndUpdate(req.user._id, { $unset: { linkedin: 1 } }, { new: true });
    res.status(200).json({ message: 'LinkedIn account disconnected.', user: profile });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/:userId', userAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });

    const profile = await Profile.findById(userId).select(PUBLIC_PROFILE_FIELDS);
    if (!profile) return res.status(404).json({ error: 'User not found' });

    res.status(200).json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
