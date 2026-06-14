import http from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from '@dc/config';
import { createLogger } from '@dc/logger';
import { initSentry } from '@dc/observability';
import { createRedisClient, isRedisEnabled } from '@dc/redis';

import { connectDatabases } from './lib/db.js';
import socketAuthMiddleware from './sockets/authMiddleware.js';
import PresenceService from './sockets/presenceService.js';
import { registerChatHandlers } from './sockets/chatHandlers.js';
import { registerGroupChatHandlers } from './sockets/groupChatHandlers.js';
import { registerCallHandlers } from './sockets/callHandlers.js';
import { registerGroupCallHandlers } from './sockets/groupCallHandlers.js';

const log = createLogger('realtime-gateway');
initSentry('realtime-gateway');
const PORT = process.env.PORT ?? 4020;

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

let presenceService;

async function waitForRedis(client) {
  if (client.status === 'ready') return;
  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
  });
}

async function start() {
  await connectDatabases();

  if (isRedisEnabled) {
    const pubClient = createRedisClient({ enableOfflineQueue: true });
    const subClient = pubClient.duplicate({ enableOfflineQueue: true });
    await Promise.all([waitForRedis(pubClient), waitForRedis(subClient)]);
    io.adapter(createAdapter(pubClient, subClient));
    log.info('Socket.IO Redis adapter enabled');
  }

  io.use(socketAuthMiddleware);

  presenceService = new PresenceService(io);

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);

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

  httpServer.listen(PORT, () => log.info(`realtime-gateway listening on :${PORT}`));
}

start().catch((err) => {
  log.error({ err: err.message }, 'Failed to start realtime-gateway');
  process.exit(1);
});

export { io, presenceService };
