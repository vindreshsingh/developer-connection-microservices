import AIUsageLog from '../models/aiUsageLog.js';

// Ported verbatim from the monolith (backend/src/middlewares/aiRateLimit.js).
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 20);

export const isAIRateLimited = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const count = await AIUsageLog.countDocuments({
    userId,
    createdAt: { $gte: startOfDay },
  });

  return count >= DAILY_LIMIT;
};

export const checkAIRateLimit = async (req, res, next) => {
  if (await isAIRateLimited(req.user._id)) {
    return res.status(429).json({ error: 'AI_RATE_LIMIT_EXCEEDED' });
  }
  next();
};
