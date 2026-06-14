import { config } from '@dc/config';

export async function getFeedExclusions(userId) {
  const res = await fetch(`${config.connectionUrl}/internal/feed-exclusions/${userId}`, {
    headers: { 'x-internal-service-token': config.internalServiceToken },
  });
  if (!res.ok) throw new Error(`feed exclusions failed: ${await res.text()}`);
  const data = await res.json();
  return data.excludedIds || [];
}

export async function getBlockContext(userId) {
  const res = await fetch(`${config.connectionUrl}/internal/block-context/${userId}`, {
    headers: { 'x-internal-service-token': config.internalServiceToken },
  });
  if (!res.ok) throw new Error(`block context failed: ${await res.text()}`);
  return res.json();
}

export async function hasAcceptedConnection(userAId, userBId) {
  const res = await fetch(
    `${config.connectionUrl}/internal/accepted-connection/${userAId}/${userBId}`,
    { headers: { 'x-internal-service-token': config.internalServiceToken } },
  );
  if (!res.ok) throw new Error(`accepted connection check failed: ${await res.text()}`);
  const data = await res.json();
  return data.accepted === true;
}

export async function getAcceptedConnectionIds(userId) {
  const res = await fetch(`${config.connectionUrl}/internal/accepted-connections/${userId}`, {
    headers: { 'x-internal-service-token': config.internalServiceToken },
  });
  if (!res.ok) throw new Error(`accepted connections failed: ${await res.text()}`);
  const data = await res.json();
  return data.connectionIds || [];
}
