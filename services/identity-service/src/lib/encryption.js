import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Ported verbatim from the monolith (backend/src/utils/encryption.js).
// AES-256-GCM for OAuth access tokens at rest. ENCRYPTION_KEY = 64 hex chars.
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') throw new TypeError('encrypt: plaintext must be a string');

  const key = getKey();
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { iv: iv.toString('hex'), tag: tag.toString('hex'), ciphertext: encrypted.toString('hex') };
}

export function decrypt({ iv, tag, ciphertext }) {
  if (iv == null || tag == null || ciphertext == null) {
    throw new TypeError('decrypt: payload must have iv, tag, and ciphertext');
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptToken(plaintext) {
  return JSON.stringify(encrypt(plaintext));
}

export function decryptToken(stored) {
  return decrypt(JSON.parse(stored));
}
