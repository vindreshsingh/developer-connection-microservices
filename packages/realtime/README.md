# @dc/realtime

Cross-process Socket.IO emitter (`@socket.io/redis-emitter`) for REST services
that need to push events to connected clients (e.g. call-service →
`call_incoming`). Publishes on the same Redis channels the realtime-gateway's
adapter subscribes to. No-op when Redis is disabled.

```js
import { emitToRoom } from '@dc/realtime';
emitToRoom(`user:${userId}`, 'call_incoming', payload);
```
