# group-service

**Status:** M5 — extracted (shared-DB phase).

REST endpoints for groups, mounted at `/groups`. Realtime group chat/typing and
group-call signaling live in the **realtime-gateway**.

## Routes

- `POST   /groups` / `GET /groups` — create / list public groups
- `GET    /groups/:groupId` — detail + members
- `POST   /groups/:groupId/join`, `DELETE /groups/:groupId/leave`
- `POST   /groups/:groupId/members/:userId`, `DELETE /groups/:groupId/members/:userId` (admin)
- `PATCH  /groups/:groupId`, `DELETE /groups/:groupId` (admin)
- `GET    /groups/:groupId/messages` — paginated history

## Owned models

`groups`, `groupmessages`.

## Shared-DB phase reads

`users` (validate invited members exist). To be replaced by a profile-service
API or events in M6.

## Run locally

```bash
pnpm install
cp .env.example .env
pnpm --filter group-service dev
```
