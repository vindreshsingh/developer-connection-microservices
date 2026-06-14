import { createDecipheriv } from 'node:crypto';

// Ported from the monolith (backend/src/utils/encryption.js) — decrypt-only
// subset. profile-service reads (never writes) OAuth access tokens to drive
// GitHub/LinkedIn enrichment. ENCRYPTION_KEY must match the monolith's key.
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function decrypt({ iv, tag, ciphertext }) {
  if (iv == null || tag == null || ciphertext == null) {
    throw new TypeError('decrypt: payload must have iv, tag, and ciphertext');
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function decryptToken(stored) {
  return decrypt(JSON.parse(stored));
}
