import { config } from '@dc/config';

export async function getFeedExclusions(userId) {
  const res = await fetch(`${config.connectionUrl}/internal/feed-exclusions/${userId}`, {
    headers: { 'x-internal-service-token': config.internalServiceToken },
  });
  if (!res.ok) throw new Error(`feed exclusions failed: ${await res.text()}`);
  const data = await res.json();
  return data.excludedIds || [];
}
