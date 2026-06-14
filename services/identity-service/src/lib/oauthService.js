import Account from '../models/account.js';
import { encryptToken } from './encryption.js';
import { bootstrapProfile, pickProfileFields } from './profileClient.js';

export async function upsertOAuthUser({ provider, providerId, email, firstName, lastName, photoUrl, rawToken }) {
  const encryptedToken = encryptToken(rawToken);
  const providerIdStr = String(providerId);

  let account = await Account.findOne({
    'oauthProviders.provider': provider,
    'oauthProviders.providerId': providerIdStr,
  });

  if (account) {
    const entry = account.oauthProviders.find(
      (p) => p.provider === provider && p.providerId === providerIdStr,
    );
    if (entry) entry.accessToken = encryptedToken;
    await account.save();
    return account;
  }

  if (email) {
    account = await Account.findOne({ email: email.toLowerCase() });
    if (account) {
      account.oauthProviders.push({
        provider,
        providerId: providerIdStr,
        accessToken: encryptedToken,
        linkedAt: new Date(),
      });
      if (!account.isEmailVerified) account.isEmailVerified = true;
      await account.save();
      return account;
    }
  }

  account = new Account({
    email: email ? email.toLowerCase() : null,
    isEmailVerified: Boolean(email),
    oauthProviders: [{ provider, providerId: providerIdStr, accessToken: encryptedToken, linkedAt: new Date() }],
  });
  await account.save();

  await bootstrapProfile(account._id, pickProfileFields({
    firstName: firstName || 'User',
    lastName,
    photoUrl: photoUrl || null,
  }));

  if (!email) account._needsEmail = true;

  return account;
}
