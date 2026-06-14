import User from '../models/user.js';
import { encryptToken } from './encryption.js';

// Ported verbatim from the monolith (backend/src/services/oauthService.js).
export async function upsertOAuthUser({ provider, providerId, email, firstName, lastName, photoUrl, rawToken }) {
  const encryptedToken = encryptToken(rawToken);
  const providerIdStr = String(providerId);

  let user = await User.findOne({
    'oauthProviders.provider': provider,
    'oauthProviders.providerId': providerIdStr,
  });

  if (user) {
    const entry = user.oauthProviders.find(
      (p) => p.provider === provider && p.providerId === providerIdStr,
    );
    if (entry) entry.accessToken = encryptedToken;
    await user.save();
    return user;
  }

  if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.oauthProviders.push({
        provider,
        providerId: providerIdStr,
        accessToken: encryptedToken,
        linkedAt: new Date(),
      });
      if (!user.isEmailVerified) user.isEmailVerified = true;
      await user.save();
      return user;
    }
  }

  const newUser = new User({
    firstName: firstName || 'User',
    lastName: lastName || undefined,
    email: email ? email.toLowerCase() : null,
    photoUrl: photoUrl || null,
    isEmailVerified: Boolean(email),
    oauthProviders: [{ provider, providerId: providerIdStr, accessToken: encryptedToken, linkedAt: new Date() }],
  });

  await newUser.save();

  if (!email) newUser._needsEmail = true;

  return newUser;
}
