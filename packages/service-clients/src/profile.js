import { config } from '@dc/config';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-internal-service-token': config.internalServiceToken,
});

export async function getProfile(userId) {
  const res = await fetch(`${config.profileUrl}/internal/profiles/${userId}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`profile fetch failed: ${await res.text()}`);
  return res.json();
}

export async function setPremium(userId, isPremium) {
  const res = await fetch(`${config.profileUrl}/internal/profiles/${userId}/premium`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ isPremium }),
  });
  if (!res.ok) throw new Error(`setPremium failed: ${await res.text()}`);
}

export async function deactivateProfile(userId) {
  const res = await fetch(`${config.profileUrl}/internal/profiles/${userId}/deactivate`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`profile deactivate failed: ${await res.text()}`);
}

export async function searchProfiles({ excludeIds = [], fields, limit = 50 } = {}) {
  const url = new URL(`${config.profileUrl}/internal/profiles/search`);
  if (excludeIds.length) url.searchParams.set('exclude', excludeIds.join(','));
  if (fields) url.searchParams.set('fields', fields);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`profile search failed: ${await res.text()}`);
  return res.json();
}

export async function getProfilesBatch(userIds) {
  if (!userIds.length) return [];
  const res = await fetch(`${config.profileUrl}/internal/profiles/batch`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ userIds }),
  });
  if (!res.ok) throw new Error(`profile batch failed: ${await res.text()}`);
  const data = await res.json();
  return data.profiles || [];
}
