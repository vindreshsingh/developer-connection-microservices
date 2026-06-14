import { config } from '@dc/config';

const serviceHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  'x-internal-service-token': config.internalServiceToken,
  ...extra,
});

export async function validateSession(userId, tokenVersion) {
  const url = new URL(`${config.identityUrl}/auth/internal/accounts/${userId}/session`);
  if (tokenVersion !== undefined) url.searchParams.set('tokenVersion', String(tokenVersion));

  const res = await fetch(url, { headers: serviceHeaders() });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`session check failed: ${await res.text()}`);
  const data = await res.json();
  return data.valid === true;
}

export async function getLinkedAccounts(userId) {
  const res = await fetch(`${config.identityUrl}/auth/internal/accounts/${userId}/linked-accounts`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) throw new Error(`linked accounts failed: ${await res.text()}`);
  return res.json();
}

export async function getOAuthToken(userId, provider) {
  const res = await fetch(`${config.identityUrl}/auth/internal/accounts/${userId}/oauth/${provider}/token`, {
    headers: serviceHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`oauth token failed: ${await res.text()}`);
  return res.json();
}

export async function disconnectOAuth(userId, provider) {
  const res = await fetch(`${config.identityUrl}/auth/internal/accounts/${userId}/oauth/${provider}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'disconnect failed');
    err.statusCode = res.status;
    throw err;
  }
}

export async function updatePassword(userId, newPassword) {
  const res = await fetch(`${config.identityUrl}/auth/internal/accounts/${userId}/password`, {
    method: 'PATCH',
    headers: serviceHeaders(),
    body: JSON.stringify({ newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'password update failed');
    err.statusCode = res.status;
    throw err;
  }
}

export async function deactivateAccount(userId) {
  const res = await fetch(`${config.identityUrl}/auth/internal/accounts/${userId}/deactivate`, {
    method: 'POST',
    headers: serviceHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`account deactivate failed: ${await res.text()}`);
}
