# call-service

**Status:** M5 — extracted (shared-DB phase).

REST endpoints for 1:1 and group video calls, mounted at `/calls`. WebRTC/LiveKit
socket signaling lives in the **realtime-gateway**; this service owns the call
lifecycle and issues LiveKit room tokens.

## Routes

- `POST   /calls` — initiate a 1:1 or group call
- `GET    /calls` — paginated history
- `GET    /calls/:callId` — metadata (participant only)
- `POST   /calls/:callId/accept` | `/decline` | `/end`
- `POST   /calls/group-token` — LiveKit room token

## Owned models

`callsessions`.

## Realtime emits

REST-side notifications (`call_incoming`, `group_call_started`, `call_rejected`,
`call_ended`, plus `call_summary` messages) are pushed to the realtime-gateway's
rooms via `@dc/realtime` (`@socket.io/redis-emitter`). **Requires `REDIS_URL`**;
without Redis those emits are no-ops.

## Shared-DB phase reads/writes

Reads: `users`, `connectionrequests`, `groups`, `plans`. Writes: `call_summary`
into chat's `messages` / `groupmessages`. To be decoupled via service APIs (or
events) in M6.

## Run locally

```bash
pnpm install
cp .env.example .env   # set MONGO_URI + JWT_SECRET (REDIS_URL + LIVEKIT_* optional)
pnpm --filter call-service dev
```
