/**
 * RecommendationService — ported from the monolith
 * (backend/src/services/RecommendationService.js). Builds the candidate
 * shortlist, asks the LLM for reasons, persists the Mongo cache, and warms the
 * Redis tier. Runs inline (Redis off) or via the worker (Redis on).
 */

import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import RecommendationCache from '../models/recommendationCache.js';
import AIUsageLog from '../models/aiUsageLog.js';
import { AIService } from './AIService.js';
import * as cache from '@dc/cache';

export const RECOMMENDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const DISMISS_EXCLUSION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const MAX_CANDIDATES = 15;

export const RECOMMENDATION_FIELDS =
  'firstName lastName photoUrl bio skills techStack githubUrl linkedinUrl';

export const recsCacheKey = (userId) => `ai:recs:${userId}`;

export const buildRecommendationsResponse = (cacheDoc) =>
  (cacheDoc?.recommendations || [])
    .filter((r) => r.userId)
    .map((r) => ({ user: r.userId, reason: r.reason }));

export const buildShortlist = async (me) => {
  const loggedInUserId = me._id;

  const interactions = await ConnectionRequest.find({
    $or: [{ fromUserId: loggedInUserId }, { toUserId: loggedInUserId }],
  }).select('fromUserId toUserId');

  const excludedIds = new Set([loggedInUserId.toString()]);
  for (const r of interactions) {
    excludedIds.add(r.fromUserId.toString());
    excludedIds.add(r.toUserId.toString());
  }

  for (const id of me.blockedUsers) excludedIds.add(id.toString());
  const blockedByOthers = await User.find({ blockedUsers: loggedInUserId }).select('_id');
  for (const u of blockedByOthers) excludedIds.add(u._id.toString());

  const cacheDoc = await RecommendationCache.findOne({ userId: loggedInUserId });
  const dismissCutoff = Date.now() - DISMISS_EXCLUSION_MS;
  for (const d of cacheDoc?.dismissed || []) {
    if (d.dismissedAt.getTime() > dismissCutoff) excludedIds.add(d.userId.toString());
  }

  const candidates = await User.find({ _id: { $nin: [...excludedIds] } }).select(
    `${RECOMMENDATION_FIELDS} experience`,
  );

  const mySkills = new Set((me.skills || []).map((s) => s.toLowerCase()));
  const myTech = new Set((me.techStack || []).map((s) => s.toLowerCase()));

  return candidates
    .map((c) => {
      const score =
        (c.skills || []).filter((s) => mySkills.has(s.toLowerCase())).length +
        (c.techStack || []).filter((s) => myTech.has(s.toLowerCase())).length;
      return { user: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((s) => s.user);
};

export const generateAndCacheRecommendations = async (user) => {
  const userId = user._id;
  const candidates = await buildShortlist(user);
  let recommendations = [];

  if (candidates.length > 0) {
    const aiResult = await AIService.generateRecommendationReasons(user, candidates);
    recommendations = aiResult
      .filter((r) => candidates[r.index])
      .map((r) => ({ userId: candidates[r.index]._id, reason: r.reason }));

    await AIUsageLog.create({ userId, endpoint: 'recommendations' });
  }

  const cacheDoc = await RecommendationCache.findOneAndUpdate(
    { userId },
    { recommendations, expiresAt: new Date(Date.now() + RECOMMENDATION_CACHE_TTL_MS) },
    { upsert: true, new: true },
  ).populate({ path: 'recommendations.userId', select: RECOMMENDATION_FIELDS });

  const data = buildRecommendationsResponse(cacheDoc);
  await cache.set(recsCacheKey(userId), data, Math.floor(RECOMMENDATION_CACHE_TTL_MS / 1000));
  return data;
};
