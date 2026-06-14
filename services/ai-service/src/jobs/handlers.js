import { QUEUE } from '../queues/names.js';
import { getProfile } from '@dc/service-clients';
import { generateAndCacheRecommendations } from '../services/RecommendationService.js';

export const handlers = {
  [QUEUE.AI_RECOMMENDATIONS]: async ({ userId }) => {
    const user = await getProfile(userId);
    if (!user) return;
    await generateAndCacheRecommendations(user);
  },
};

export default handlers;
