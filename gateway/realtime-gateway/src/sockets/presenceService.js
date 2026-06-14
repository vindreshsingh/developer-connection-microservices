import ConnectionRequest from '../models/connectionRequest.js';
import { getRedis } from '@dc/redis';

// Ported from the monolith (backend/src/sockets/presenceService.js). Tracks
// connected sockets per user; with Redis the count is cluster-wide so
// online/offline transitions are computed across all realtime-gateway
// instances. Presence broadcasts go to the recipient's `user:<id>` room, which
// the Socket.IO Redis adapter fans out cross-instance.
class PresenceService {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map();
  }

  _redisKey(userId) {
    return `presence:user:${userId}`;
  }

  isOnline(userId) {
    const sockets = this.userSockets.get(userId.toString());
    return Boolean(sockets && sockets.size > 0);
  }

  lastSeenAt() {
    return null;
  }

  async _acceptedConnectionIds(userId) {
    const requests = await ConnectionRequest.find({
      status: 'accepted',
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }).select('fromUserId toUserId');

    return requests.map((request) =>
      (request.fromUserId.equals(userId) ? request.toUserId : request.fromUserId).toString(),
    );
  }

  async _broadcastPresence(userId, status) {
    let connectionIds;
    try {
      connectionIds = await this._acceptedConnectionIds(userId);
    } catch {
      return;
    }
    const payload = { userId: userId.toString(), status, lastSeenAt: this.lastSeenAt() };

    connectionIds.forEach((connectionId) => {
      this.io.to(`user:${connectionId}`).emit('presence_update', payload);
    });
  }

  async registerConnection(socket) {
    const userId = socket.user._id.toString();

    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId).add(socket.id);

    const redis = getRedis();
    let wasOffline;
    if (redis) {
      const countBefore = await redis.scard(this._redisKey(userId));
      await redis.sadd(this._redisKey(userId), socket.id);
      wasOffline = countBefore === 0;
    } else {
      wasOffline = this.userSockets.get(userId).size === 1;
    }

    if (wasOffline) await this._broadcastPresence(userId, 'online');
  }

  async registerDisconnection(socket) {
    const userId = socket.user._id.toString();
    const sockets = this.userSockets.get(userId);
    const wasTracked = Boolean(sockets);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) this.userSockets.delete(userId);
    }

    const redis = getRedis();
    let becameOffline;
    if (redis) {
      await redis.srem(this._redisKey(userId), socket.id);
      becameOffline = (await redis.scard(this._redisKey(userId))) === 0;
    } else {
      becameOffline = wasTracked && sockets.size === 0;
    }

    if (becameOffline) await this._broadcastPresence(userId, 'offline');
  }
}

export default PresenceService;
