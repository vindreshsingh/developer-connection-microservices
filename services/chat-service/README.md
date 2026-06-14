# chat-service

**Status:** M5 — extracted (shared-DB phase).

REST endpoints for 1:1 chat, mounted at `/chat`. Realtime send/typing/react/
read live in the **realtime-gateway**; this service serves the HTTP read and
bootstrap paths.

## Routes

- `GET    /chat/conversations` — list conversations (block-aware, hide-but-retain)
- `POST   /chat/conversations/:userId` — get-or-create with an accepted connection
- `GET    /chat/conversations/:conversationId/messages` — paginated history
- `POST   /chat/conversations/:conversationId/read` — mark read

## Owned models

`conversations`, `messages`.

## Shared-DB phase reads

`users` (block lists, profile fields), `connectionrequests` (accepted-connection
boundary via `canUsersChat`). To be replaced by profile/connection service APIs
or events in M6.

## Run locally

```bash
pnpm install
cp .env.example .env
pnpm --filter chat-service dev
```
