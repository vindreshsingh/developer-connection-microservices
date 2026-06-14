/**
 * RecommendationService — builds AI match shortlist via profile + connection APIs.
 */

import RecommendationCache from '../models/recommendationCache.js';
import AIUsageLog from '../models/aiUsageLog.js';
import { AIService } from './AIService.js';
import * as cache from '@dc/cache';
import { getFeedExclusions, searchProfiles, getProfilesBatch } from '@dc/service-clients';

export const RECOMMENDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DISMISS_EXCLUSION_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_CANDIDATES = 15;

export const RECOMMENDATION_FIELDS =
  'firstName lastName photoUrl bio skills techStack githubUrl linkedinUrl experience';

export const recsCacheKey = (userId) => `ai:recs:${userId}`;

export const buildRecommendationsResponse = (cacheDoc, profileMap) =>
  (cacheDoc?.recommendations || [])
    .filter((r) => r.userId)
    .map((r) => ({
      user: profileMap.get(String(r.userId)) || r.userId,
      reason: r.reason,
    }));

export const buildShortlist = async (me) => {
  const loggedInUserId = me._id.toString();
  const excludedIds = new Set(await getFeedExclusions(loggedInUserId));

  const cacheDoc = await RecommendationCache.findOne({ userId: loggedInUserId });
  const dismissCutoff = Date.now() - DISMISS_EXCLUSION_MS;
  for (const d of cacheDoc?.dismissed || []) {
    if (d.dismissedAt.getTime() > dismissCutoff) excludedIds.add(d.userId.toString());
  }

  const candidates = await searchProfiles({
    excludeIds: [...excludedIds],
    fields: RECOMMENDATION_FIELDS,
    limit: 200,
  });

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
  );

  const profiles = await getProfilesBatch(recommendations.map((r) => String(r.userId)));
  const profileMap = new Map(profiles.map((p) => [String(p._id), p]));

  const data = buildRecommendationsResponse(cacheDoc, profileMap);
  await cache.set(recsCacheKey(userId), data, Math.floor(RECOMMENDATION_CACHE_TTL_MS / 1000));
  return data;
};
