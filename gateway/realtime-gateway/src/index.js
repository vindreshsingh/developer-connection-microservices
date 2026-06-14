import http from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectMongo } from '@dc/mongo';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { createRedisClient, isRedisEnabled } from '@dc/redis';

import socketAuthMiddleware from './sockets/authMiddleware.js';
import PresenceService from './sockets/presenceService.js';
import { registerChatHandlers } from './sockets/chatHandlers.js';
import { registerGroupChatHandlers } from './sockets/groupChatHandlers.js';
import { registerCallHandlers } from './sockets/callHandlers.js';
import { registerGroupCallHandlers } from './sockets/groupCallHandlers.js';

const log = createLogger('realtime-gateway');
const PORT = process.env.PORT ?? 4020;
const MONGO_URI = process.env.MONGO_URI ?? config.mongoUri;

// Plain HTTP server: a tiny /health endpoint for ALB checks, plus the Socket.IO
// upgrade handler. The api-gateway proxies WS upgrades here (cookies intact).
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'realtime-gateway', redis: isRedisEnabled }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const io = new Server(httpServer, {
  cors: { origin: config.frontendUrl, credentials: true },
});

// Redis adapter fans `io.to(room).emit(...)` across all realtime-gateway
// instances AND lets REST services (via @dc/realtime's redis emitter) push
// events into rooms held here. No-op single-instance behavior without Redis.
if (isRedisEnabled) {
  const pubClient = createRedisClient();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  log.info('Socket.IO Redis adapter enabled');
}

io.use(socketAuthMiddleware);

const presenceService = new PresenceService(io);

io.on('connection', (socket) => {
  // Personal room so REST services / other handlers can push per-user events.
  socket.join(`user:${socket.user._id}`);

  // Register listeners synchronously, before any await (clients may emit
  // immediately on connect; Socket.IO does not buffer for late listeners).
  registerChatHandlers(io, socket);
  registerGroupChatHandlers(io, socket);
  registerCallHandlers(io, socket);
  registerGroupCallHandlers(io, socket);

  presenceService.registerConnection(socket).catch((err) => {
    socket.emit('chat_error', { event: 'presence', message: err.message });
  });

  socket.on('disconnect', async () => {
    await presenceService.registerDisconnection(socket);
  });
});

connectMongo(MONGO_URI)
  .then(() => {
    log.info('MongoDB connected');
    httpServer.listen(PORT, () => log.info(`realtime-gateway listening on :${PORT}`));
  })
  .catch((err) => {
    log.error({ err: err.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  });

export { io, presenceService };
