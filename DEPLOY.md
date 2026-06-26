# Production deploy (EC2 — pull-only)

Images are built in CI and pushed to GHCR. **The EC2 host never builds** — it
only pulls pre-built images. No `pnpm install` / `docker build` on the server.

## How it works

1. Push to `main` → **CI** runs (lint/build/test).
2. On CI success → **Build & Push Images** workflow (`.github/workflows/build-images.yml`)
   builds all 13 service images in parallel and pushes to GHCR:
   `ghcr.io/vindreshsingh/dc-<service>:latest` (and `:<git-sha>`).
3. EC2 pulls and restarts.

## One-time EC2 setup

The compose file references GHCR images. If the packages are **private**, log in once:

```bash
# Create a GitHub PAT (classic) with read:packages scope, then:
echo <PAT> | docker login ghcr.io -u vindreshsingh --password-stdin
```

(Or make the GHCR packages public — then no login is needed to pull.)

## Deploy a new version

```bash
cd /path/to/microservices         # folder with docker-compose.prod.yml
git pull origin main              # get latest compose + .env-referenced changes

docker compose -f docker-compose.prod.yml pull        # pull new images from GHCR
docker compose -f docker-compose.prod.yml up -d        # recreate changed containers
docker image prune -f                                  # optional: clean old images
```

Pin a specific build instead of `latest`:

```bash
IMAGE_TAG=<git-sha> docker compose -f docker-compose.prod.yml up -d
```

## Notes

- Secrets/config still come from the host root `.env` (e.g. `CLOUDINARY_*`,
  `PREMIUM_ALLOWLIST`, `RAZORPAY_*`, `MONGO_BASE`). Pulling images does not change `.env`.
- After a billing image update, (re)seed plans once: `docker compose -f docker-compose.prod.yml exec billing-service npm run seed`.
- The `build:` blocks remain in compose for local builds; production uses `image:` + `pull`.
- Trigger a rebuild manually from the Actions tab → "Build & Push Images" → Run workflow.
