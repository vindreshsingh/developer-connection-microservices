import { config } from '@dc/config';

const serviceHeaders = () => ({
  'Content-Type': 'application/json',
  'x-internal-service-token': config.internalServiceToken,
});

const PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'photoUrl',
  'bio',
  'skills',
  'githubUrl',
  'linkedinUrl',
  'age',
  'gender',
];

export const pickProfileFields = (data) =>
  Object.fromEntries(Object.entries(data).filter(([k]) => PROFILE_FIELDS.includes(k)));

export async function bootstrapProfile(userId, fields) {
  const res = await fetch(`${config.profileUrl}/internal/profiles`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(userId), ...fields }),
  });
  if (!res.ok) throw new Error(`profile bootstrap failed: ${await res.text()}`);
  return res.json();
}

export async function getProfile(userId) {
  const res = await fetch(`${config.profileUrl}/internal/profiles/${userId}`, {
    headers: serviceHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`profile fetch failed: ${await res.text()}`);
  return res.json();
}

export async function deactivateProfile(userId) {
  const res = await fetch(`${config.profileUrl}/internal/profiles/${userId}/deactivate`, {
    method: 'POST',
    headers: serviceHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`profile deactivate failed: ${await res.text()}`);
}

export function mergeAccountProfile(account, profile) {
  const accountObj = account.toObject ? account.toObject() : account;
  delete accountObj.password;
  delete accountObj.emailVerifyToken;
  delete accountObj.passwordResetToken;
  const profileObj = profile && (profile.toObject ? profile.toObject() : profile);
  return { ...(profileObj || {}), ...accountObj, _id: accountObj._id };
}
