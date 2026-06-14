import { Emitter } from '@socket.io/redis-emitter';
import { getRedis, isRedisEnabled } from '@dc/redis';
import { createLogger } from '@dc/logger';

// Cross-process Socket.IO emitter for REST services (e.g. call-service emits
// `call_incoming` to a user's room). It publishes on the same Redis channels the
// realtime-gateway's @socket.io/redis-adapter subscribes to, so a room emit from
// any service reaches the right sockets regardless of which process they're on.
//
// When Redis is disabled there is no shared bus, so emits are no-ops and the
// emitted event simply doesn't fan out across processes (single-instance dev,
// where the monolith still owns realtime until the final cutover). This keeps
// the contract identical to the monolith's `if (io) io.to(...).emit(...)` guard.
const log = createLogger('realtime-emitter');

const NOOP_CHAIN = { emit: () => {} };
const NOOP_EMITTER = { to: () => NOOP_CHAIN };

let emitter = null;

export const getEmitter = () => {
  if (!isRedisEnabled) return NOOP_EMITTER;
  if (!emitter) {
    emitter = new Emitter(getRedis());
    log.info('Socket.IO Redis emitter ready');
  }
  return emitter;
};

/**
 * `to(room).emit(event, payload)` against the shared bus, mirroring the
 * monolith's `io.to(room).emit(...)`. Safe no-op without Redis.
 */
export const emitToRoom = (room, event, payload) => {
  getEmitter().to(room).emit(event, payload);
};
