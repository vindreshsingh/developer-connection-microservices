import Subscription from '../models/subscription.js';
import User from '../models/user.js';

// Ported verbatim from the monolith (backend/src/middlewares/premium.js).
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export const requirePremium = (featureName) => async (req, res, next) => {
  const user = req.user;

  if (user.isPremium) {
    const pastDue = await Subscription.findOne({ userId: user._id, status: 'past_due' });
    if (pastDue?.currentPeriodEnd && Date.now() > pastDue.currentPeriodEnd.getTime() + GRACE_PERIOD_MS) {
      pastDue.status = 'expired';
      await pastDue.save();
      await User.findByIdAndUpdate(user._id, { isPremium: false });
      user.isPremium = false;
    }
  }

  if (!user.isPremium) {
    return res.status(403).json({ error: 'PREMIUM_REQUIRED', feature: featureName });
  }

  next();
};
