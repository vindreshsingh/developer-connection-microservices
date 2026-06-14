# realtime-gateway

**Status:** M5 — extracted (shared-DB phase).

The Socket.IO front door for all realtime traffic. The api-gateway proxies
WebSocket upgrades (`/socket.io`) here; this process owns every socket handler
and presence.

## What it owns

- **Socket auth** — verifies the same httpOnly `token` cookie as REST (the
  api-gateway forwards the upgrade with cookies, but its HTTP edge-auth does not
  run on raw WS upgrades, so this verifies the cookie itself).
- **Presence** — connected-socket registry; cluster-wide via Redis.
- **Chat handlers** — `join_conversation`, `send_message`, `react`, `typing`,
  `mark_read`.
- **Group chat handlers** — `join_group`, `send_group_message`, `group_typing`,
  `leave_group`.
- **Call signaling** — `call_offer`/`call_answer`/`ice_candidate`/`call_ended`/
  `call_rejected` (1:1) and `group_call_join`/`leave`/`end` (group/LiveKit).

## Shared-DB phase reads/writes

Reads: `users`, `connectionrequests`, `groups`. Reads/writes: `conversations`,
`messages`, `groupmessages`, `callsessions`. Writes are limited to realtime
state (messages, reactions, read receipts, call lifecycle) — same as the
monolith's socket layer.

## Cross-process emits

REST services (e.g. call-service emitting `call_incoming`) publish via
`@dc/realtime` (`@socket.io/redis-emitter`) onto the same Redis channels the
adapter here subscribes to. **Requires `REDIS_URL`** for cross-process delivery;
without Redis those emits are no-ops (the monolith still owns realtime until the
final cutover).

## Run locally

```bash
pnpm install
cp .env.example .env   # set MONGO_URI + JWT_SECRET (REDIS_URL recommended)
pnpm --filter realtime-gateway dev
```

## Migration checklist

- [x] Socket auth, presence, chat/group/call handlers ported
- [x] Redis adapter for cross-instance fan-out
- [ ] Remove socket layer from the monolith (cutover)
- [ ] Replace cross-context model reads with service APIs / events (M6)
