/**
 * Jobs REST API — ported from the monolith (backend/src/routes/jobs.js).
 * Mounted at /jobs. Notifications are written directly to the shared
 * `notifications` collection (shared-DB phase); the realtime emit moves in M5.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { getExcludedUserIds } from '../lib/blocking.js';
import * as cache from '@dc/cache';
import JobPosting from '../models/jobPosting.js';
import JobApplication from '../models/jobApplication.js';
import Notification from '../models/notification.js';

const router = Router();

const PAGE_SIZE = 20;
const APPLICATION_PAGE_SIZE = 20;
const JOBS_LIST_CACHE_TTL = 30; // seconds

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'freelance', 'collaboration'];
const LOCATION_MODES = ['remote', 'onsite', 'hybrid'];
const POSTING_STATUSES = ['open', 'closed'];
const APPLICATION_STATUSES = ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted'];

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) return [];
  return [...new Set(skills.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
};

const computeSkillMatchScore = (requiredSkills, user) => {
  const required = normalizeSkills(requiredSkills);
  if (required.length === 0) return 0;
  const mine = new Set(normalizeSkills([...(user.skills ?? []), ...(user.techStack ?? [])]));
  const overlap = required.filter((skill) => mine.has(skill)).length;
  return Math.round((overlap / required.length) * 100);
};

const buildSalaryRange = (salaryRange) => ({
  min: salaryRange?.min ?? null,
  max: salaryRange?.max ?? null,
  currency: salaryRange?.currency?.trim() || 'USD',
});

router.use(userAuth);

// POST /jobs
router.post('/', async (req, res) => {
  try {
    const { title, company, description, type, locationMode, location, requiredSkills, salaryRange } = req.body;

    const trimmedTitle = title?.trim();
    const trimmedDescription = description?.trim();

    if (!trimmedTitle) return res.status(400).json({ error: 'Title is required.' });
    if (!trimmedDescription) return res.status(400).json({ error: 'Description is required.' });
    if (!JOB_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid job type.' });
    if (locationMode !== undefined && !LOCATION_MODES.includes(locationMode))
      return res.status(400).json({ error: 'Invalid location mode.' });

    const job = await JobPosting.create({
      postedBy: req.user._id,
      title: trimmedTitle,
      company: company?.trim() || '',
      description: trimmedDescription,
      type,
      locationMode: locationMode || 'remote',
      location: location?.trim() || '',
      requiredSkills: normalizeSkills(requiredSkills),
      salaryRange: buildSalaryRange(salaryRange),
    });

    await job.populate('postedBy', 'firstName lastName photoUrl');

    res.status(201).json({ message: 'Job posting created.', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);

    if (req.query.type && !JOB_TYPES.includes(req.query.type))
      return res.status(400).json({ error: 'Invalid job type.' });

    const cacheKey = `jobs:list:${req.user._id}:${req.query.type || 'all'}:${req.query.skills || ''}:${page}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    const excludedIds = await getExcludedUserIds(req.user);
    const filter = { status: 'open', deletedAt: null, postedBy: { $nin: excludedIds } };

    if (req.query.type) filter.type = req.query.type;

    if (req.query.skills) {
      const skills = normalizeSkills(req.query.skills.split(','));
      if (skills.length > 0) filter.requiredSkills = { $in: skills };
    }

    const total = await JobPosting.countDocuments(filter);
    const jobs = await JobPosting.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('postedBy', 'firstName lastName photoUrl');

    const payload = {
      data: jobs.map((job) => ({
        ...job.toObject(),
        skillMatchScore: computeSkillMatchScore(job.requiredSkills, req.user),
      })),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasNextPage: page * PAGE_SIZE < total,
      },
    };

    await cache.set(cacheKey, payload, JOBS_LIST_CACHE_TTL);
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs/applications/mine — registered before GET /:jobId to avoid misrouting.
router.get('/applications/mine', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { applicantId: req.user._id };

    const total = await JobApplication.countDocuments(filter);
    const applications = await JobApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * APPLICATION_PAGE_SIZE)
      .limit(APPLICATION_PAGE_SIZE)
      .populate('jobId', 'title company type status');

    res.status(200).json({
      data: applications,
      pagination: {
        page,
        pageSize: APPLICATION_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / APPLICATION_PAGE_SIZE),
        hasNextPage: page * APPLICATION_PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs/:jobId
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!validObjectId(jobId)) return res.status(404).json({ error: 'Job posting not found.' });

    const job = await JobPosting.findOne({ _id: jobId, deletedAt: null }).populate(
      'postedBy',
      'firstName lastName photoUrl',
    );
    if (!job) return res.status(404).json({ error: 'Job posting not found.' });

    const obj = job.toObject();
    obj.skillMatchScore = computeSkillMatchScore(job.requiredSkills, req.user);

    if (!job.postedBy._id.equals(req.user._id)) {
      const application = await JobApplication.findOne({
        jobId: job._id,
        applicantId: req.user._id,
      }).select('_id status');
      obj.myApplication = application ? { _id: application._id, status: application.status } : null;
    }

    res.status(200).json({ job: obj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /jobs/:jobId
router.patch('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!validObjectId(jobId)) return res.status(404).json({ error: 'Job posting not found.' });

    const job = await JobPosting.findOne({ _id: jobId, deletedAt: null });
    if (!job) return res.status(404).json({ error: 'Job posting not found.' });

    if (!job.postedBy.equals(req.user._id))
      return res.status(403).json({ error: 'You can only update your own job postings.' });

    const { title, company, description, type, locationMode, location, requiredSkills, salaryRange, status } = req.body;

    if (type !== undefined && !JOB_TYPES.includes(type))
      return res.status(400).json({ error: 'Invalid job type.' });
    if (locationMode !== undefined && !LOCATION_MODES.includes(locationMode))
      return res.status(400).json({ error: 'Invalid location mode.' });
    if (status !== undefined && !POSTING_STATUSES.includes(status))
      return res.status(400).json({ error: 'Invalid status.' });

    if (title !== undefined) {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return res.status(400).json({ error: 'Title cannot be empty.' });
      job.title = trimmedTitle;
    }
    if (description !== undefined) {
      const trimmedDescription = description.trim();
      if (!trimmedDescription) return res.status(400).json({ error: 'Description cannot be empty.' });
      job.description = trimmedDescription;
    }
    if (company !== undefined) job.company = company.trim();
    if (type !== undefined) job.type = type;
    if (locationMode !== undefined) job.locationMode = locationMode;
    if (location !== undefined) job.location = location.trim();
    if (requiredSkills !== undefined) job.requiredSkills = normalizeSkills(requiredSkills);
    if (salaryRange !== undefined) job.salaryRange = buildSalaryRange(salaryRange);
    if (status !== undefined) job.status = status;

    await job.save();
    await job.populate('postedBy', 'firstName lastName photoUrl');

    res.status(200).json({ message: 'Job posting updated.', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /jobs/:jobId
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!validObjectId(jobId)) return res.status(404).json({ error: 'Job posting not found.' });

    const job = await JobPosting.findOne({ _id: jobId, deletedAt: null });
    if (!job) return res.status(404).json({ error: 'Job posting not found.' });

    if (!job.postedBy.equals(req.user._id))
      return res.status(403).json({ error: 'You can only delete your own job postings.' });

    job.deletedAt = new Date();
    await job.save();

    res.status(200).json({ message: 'Job posting deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /jobs/:jobId/apply
router.post('/:jobId/apply', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!validObjectId(jobId)) return res.status(404).json({ error: 'Job posting not found.' });

    const job = await JobPosting.findOne({ _id: jobId, deletedAt: null });
    if (!job) return res.status(404).json({ error: 'Job posting not found.' });

    if (job.postedBy.equals(req.user._id))
      return res.status(400).json({ error: 'You cannot apply to your own job posting.' });

    if (job.status === 'closed') return res.status(400).json({ error: 'This job posting is closed.' });

    const coverNote = req.body.coverNote?.trim() ?? '';
    if (coverNote.length > 1000)
      return res.status(400).json({ error: 'Cover note cannot exceed 1000 characters.' });

    let application;
    try {
      application = await JobApplication.create({ jobId: job._id, applicantId: req.user._id, coverNote });
    } catch (err) {
      if (err.code === 11000)
        return res.status(409).json({ error: 'You have already applied to this job posting.' });
      throw err;
    }

    job.applicationCount += 1;
    await job.save();

    await Notification.create({
      recipientId: job.postedBy,
      actorId: req.user._id,
      type: 'job_application',
      jobId: job._id,
    });

    res.status(201).json({ message: 'Application submitted.', application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs/:jobId/applications
router.get('/:jobId/applications', async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!validObjectId(jobId)) return res.status(404).json({ error: 'Job posting not found.' });

    const job = await JobPosting.findOne({ _id: jobId, deletedAt: null });
    if (!job) return res.status(404).json({ error: 'Job posting not found.' });

    if (!job.postedBy.equals(req.user._id))
      return res.status(403).json({ error: 'You can only view applicants for your own job postings.' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { jobId: job._id };

    const total = await JobApplication.countDocuments(filter);
    const applications = await JobApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * APPLICATION_PAGE_SIZE)
      .limit(APPLICATION_PAGE_SIZE)
      .populate('applicantId', 'firstName lastName photoUrl skills techStack experience githubUrl linkedinUrl');

    res.status(200).json({
      data: applications.map((application) => ({
        ...application.toObject(),
        skillMatchScore: computeSkillMatchScore(job.requiredSkills, application.applicantId),
      })),
      pagination: {
        page,
        pageSize: APPLICATION_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / APPLICATION_PAGE_SIZE),
        hasNextPage: page * APPLICATION_PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /jobs/:jobId/applications/:applicationId
router.patch('/:jobId/applications/:applicationId', async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    if (!validObjectId(jobId) || !validObjectId(applicationId))
      return res.status(404).json({ error: 'Application not found.' });

    const job = await JobPosting.findOne({ _id: jobId, deletedAt: null });
    if (!job) return res.status(404).json({ error: 'Job posting not found.' });

    if (!job.postedBy.equals(req.user._id))
      return res.status(403).json({ error: 'You can only manage applications for your own job postings.' });

    const application = await JobApplication.findOne({ _id: applicationId, jobId: job._id });
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    const { status } = req.body;
    if (!APPLICATION_STATUSES.includes(status))
      return res.status(400).json({ error: 'Invalid application status.' });

    application.status = status;
    await application.save();

    await Notification.create({
      recipientId: application.applicantId,
      actorId: req.user._id,
      type: 'job_application_status',
      jobId: job._id,
    });

    res.status(200).json({ message: 'Application status updated.', application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
