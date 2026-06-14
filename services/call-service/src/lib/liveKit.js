import { AccessToken } from 'livekit-server-sdk';

// Ported verbatim from the monolith (backend/src/services/LiveKitService.js).
const TOKEN_TTL = '1h';

export async function generateRoomToken({ callId, userId, displayName }) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in the environment.');
  }

  const roomName = `call:${callId}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: displayName ?? userId,
    ttl: TOKEN_TTL,
  });

  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

  return at.toJwt();
}
