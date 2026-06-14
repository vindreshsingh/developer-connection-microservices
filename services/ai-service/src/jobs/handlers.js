import { QUEUE } from '../queues/names.js';
import User from '../models/user.js';
import { generateAndCacheRecommendations } from '../services/RecommendationService.js';

// Single definition of each job's work — shared by the worker (Redis on) and
// inline execution (Redis off). Ported from the monolith jobs/handlers.js
// (ai-recommendations entry only).
export const handlers = {
  [QUEUE.AI_RECOMMENDATIONS]: async ({ userId }) => {
    const user = await User.findById(userId);
    if (!user) return;
    await generateAndCacheRecommendations(user);
  },
};

export default handlers;
