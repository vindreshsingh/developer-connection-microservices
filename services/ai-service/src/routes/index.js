/**
 * AI Developer Assistant routes — ported from the monolith (backend/src/routes/ai.js).
 * Mounted at /ai. All routes require auth + active premium subscription.
 * LLM-backed routes consume the daily AI budget.
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import userAuth from '../middlewares/auth.js';
import { requirePremium } from '../middlewares/premium.js';
import { checkAIRateLimit, isAIRateLimited } from '../middlewares/aiRateLimit.js';
import RecommendationCache from '../models/recommendationCache.js';
import ResumeFeedback from '../models/resumeFeedback.js';
import InterviewSession from '../models/interviewSession.js';
import AIUsageLog from '../models/aiUsageLog.js';
import { AIService, AIServiceError } from '../services/AIService.js';
import {
  RECOMMENDATION_FIELDS,
  recsCacheKey,
  buildRecommendationsResponse,
  generateAndCacheRecommendations,
} from '../services/RecommendationService.js';
import { uploadRawBuffer } from '@dc/cloudinary';
import * as cache from '@dc/cache';
import { isRedisEnabled } from '@dc/redis';
import { enqueue } from '../queues/index.js';
import { QUEUE } from '../queues/names.js';

const router = Router();

const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5MB
const INTERVIEW_TURN_CAP = 10;
const PAGE_SIZE = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

const profileContext = (user) => ({
  skills: user.skills,
  techStack: user.techStack,
  experience: user.experience,
});

router.use(userAuth, requirePremium('aiAssistant'));

// GET /ai/recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const userId = req.user._id;

    const fast = await cache.get(recsCacheKey(userId));
    if (fast) return res.status(200).json({ data: fast });

    const existing = await RecommendationCache.findOne({ userId });

    if (existing && existing.expiresAt.getTime() > Date.now()) {
      const populated = await existing.populate({
        path: 'recommendations.userId',
        select: RECOMMENDATION_FIELDS,
      });
      const data = buildRecommendationsResponse(populated);
      const ttlSeconds = Math.floor((existing.expiresAt.getTime() - Date.now()) / 1000);
      await cache.set(recsCacheKey(userId), data, ttlSeconds);
      return res.status(200).json({ data });
    }

    if (await isAIRateLimited(userId)) {
      return res.status(429).json({ error: 'AI_RATE_LIMIT_EXCEEDED' });
    }

    if (isRedisEnabled) {
      await enqueue(QUEUE.AI_RECOMMENDATIONS, { userId: userId.toString() }, { jobId: `recs:${userId}` });
      return res.status(202).json({ status: 'generating', data: [] });
    }

    const data = await generateAndCacheRecommendations(req.user);
    res.status(200).json({ data });
  } catch (err) {
    if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/recommendations/:userId/dismiss
router.post('/recommendations/:userId/dismiss', async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const recCache = await RecommendationCache.findOne({ userId: req.user._id });
    if (!recCache) return res.status(404).json({ error: 'No recommendations found' });

    recCache.recommendations = recCache.recommendations.filter(
      (r) => r.userId.toString() !== targetUserId,
    );
    recCache.dismissed = recCache.dismissed.filter((d) => d.userId.toString() !== targetUserId);
    recCache.dismissed.push({ userId: targetUserId, dismissedAt: new Date() });
    await recCache.save();

    await cache.del(recsCacheKey(req.user._id));

    res.status(200).json({ message: 'Recommendation dismissed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/resume-feedback
router.post(
  '/resume-feedback',
  (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  checkAIRateLimit,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No resume file provided' });

      const parser = new PDFParse({ data: req.file.buffer });
      const parsed = await parser.getText();
      await parser.destroy();

      const extractedText = parsed.text?.trim();
      if (!extractedText) return res.status(400).json({ error: 'Could not extract text from PDF' });

      const uploaded = await uploadRawBuffer(req.file.buffer, 'resumes');
      const feedback = await AIService.getResumeFeedback(extractedText, profileContext(req.user));

      const doc = await ResumeFeedback.create({
        userId: req.user._id,
        resumeUrl: uploaded.secure_url,
        extractedText,
        feedback,
      });

      await AIUsageLog.create({ userId: req.user._id, endpoint: 'resume-feedback' });

      res.status(201).json({ data: doc });
    } catch (err) {
      if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /ai/resume-feedback
router.get('/resume-feedback', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { userId: req.user._id };

    const total = await ResumeFeedback.countDocuments(filter);
    const items = await ResumeFeedback.find(filter)
      .select('-extractedText')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE);

    res.status(200).json({
      data: items,
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

// POST /ai/interview/start
router.post('/interview/start', checkAIRateLimit, async (req, res) => {
  try {
    const { focusArea } = req.body;
    const result = await AIService.startInterview(focusArea, profileContext(req.user));

    const session = await InterviewSession.create({
      userId: req.user._id,
      focusArea: focusArea || null,
      transcript: [{ role: 'assistant', content: result.question }],
    });

    await AIUsageLog.create({ userId: req.user._id, endpoint: 'interview' });

    res.status(201).json({ data: { sessionId: session._id, question: result.question } });
  } catch (err) {
    if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/interview/:sessionId/respond
router.post('/interview/:sessionId/respond', checkAIRateLimit, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId))
      return res.status(400).json({ error: 'Invalid session id' });

    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: 'answer is required' });

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (session.status === 'completed')
      return res.status(400).json({ error: 'Interview session already completed' });

    session.transcript.push({ role: 'user', content: answer });
    const turnCount = session.transcript.filter((t) => t.role === 'user').length;

    const result = await AIService.continueInterview(session.transcript, session.focusArea);
    const nextQuestion = turnCount >= INTERVIEW_TURN_CAP ? null : (result.nextQuestion ?? null);

    session.transcript.push({
      role: 'assistant',
      content: nextQuestion ? `${result.feedback}\n\n${nextQuestion}` : result.feedback,
    });

    if (!nextQuestion) {
      session.status = 'completed';
      session.completedAt = new Date();
    }

    await session.save();
    await AIUsageLog.create({ userId: req.user._id, endpoint: 'interview' });

    res.status(200).json({ data: { feedback: result.feedback, nextQuestion, status: session.status } });
  } catch (err) {
    if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/interview/:sessionId/end
router.post('/interview/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId))
      return res.status(400).json({ error: 'Invalid session id' });

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    res.status(200).json({ data: session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ai/interview
router.get('/interview', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { userId: req.user._id };

    const total = await InterviewSession.countDocuments(filter);
    const items = await InterviewSession.find(filter)
      .select('-transcript')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE);

    res.status(200).json({
      data: items,
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

// GET /ai/interview/:sessionId
router.get('/interview/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId))
      return res.status(400).json({ error: 'Invalid session id' });

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });

    res.status(200).json({ data: session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
