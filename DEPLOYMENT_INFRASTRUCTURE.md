# Deployment and Infrastructure Architecture

This setup provides a production-oriented Docker and CI/CD foundation for the ecommerce platform.

## Services

- `web`: Next.js frontend.
- `api`: Fastify API.
- `worker`: BullMQ async worker runtime.
- `postgres`: PostgreSQL source of truth.
- `redis`: BullMQ, locks, rate limits, and cache.
- `meilisearch`: product/category search index.

## Docker Architecture

Application images are built from app-specific Dockerfiles:

- `apps/web/Dockerfile`
- `apps/api/Dockerfile`
- `apps/worker/Dockerfile`

Each image uses a multi-stage pattern:

1. base Node + Corepack
2. dependency install with pnpm
3. validation/build stage
4. runtime stage

The current workspace packages export TypeScript source, so API and worker runtime images preserve workspace source and run through `tsx`. Once package exports are switched to built `dist` outputs, these images can be slimmed to production-only dependencies and plain `node dist/index.js`.

## Compose Files

`docker-compose.yml` is for local full-stack development:

```bash
docker compose up --build
```

`docker-compose.prod.yml` is for deployment with prebuilt images:

```bash
REGISTRY_IMAGE=ghcr.io/your-org/ecommerce IMAGE_TAG=<sha> docker compose -f docker-compose.prod.yml up -d
```

Production compose expects `.env.production` on the server. Keep that file out of git.

## Environment Strategy

Use checked-in templates only:

- `.env.example` for local development.
- `.env.production.example` for production operators.

Runtime secrets should come from:

- GitHub environment secrets for CI/CD.
- server-local `.env.production` for compose deployments.
- a managed secret store when moving to Kubernetes/ECS/Fly/Render.

Do not bake secrets into images.

## Health Checks

Infrastructure health checks:

- Postgres: `pg_isready`
- Redis: `redis-cli ping`
- Meilisearch: `/health`

Application health checks:

- API: `GET /health`
- Web: `GET /`
- Worker: process-level health placeholder

The worker has no HTTP server by design. For richer production health, add a worker heartbeat key in Redis and check freshness from orchestration.

## CI/CD

GitHub Actions:

- `.github/workflows/ci.yml`
  - installs dependencies
  - typechecks
  - runs tests
  - validates Prisma schema

- `.github/workflows/docker-publish.yml`
  - builds `web`, `api`, and `worker`
  - pushes images to GHCR
  - tags by branch, tag, and commit SHA

- `.github/workflows/deploy.yml`
  - manual deployment
  - copies compose file
  - pulls selected image tag
  - restarts the compose stack

Required deployment secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

## Deployment Flow

1. PR runs CI.
2. Merge to `main`.
3. Images publish to GHCR.
4. Trigger deploy workflow with a SHA tag.
5. Server pulls immutable images and restarts services.
6. Compose health checks verify dependencies and app readiness.

## Tradeoffs

Compose is a pragmatic startup deployment target. It is simple, cheap, and understandable.

Tradeoffs:

- no built-in horizontal autoscaling
- limited secret management
- limited zero-downtime rollout controls
- host-level availability unless paired with managed infrastructure

When traffic grows, move the same image boundaries to Kubernetes, ECS, Nomad, or a managed app platform. Keep Postgres, Redis, and Meilisearch managed where possible.

## Production Hardening Checklist

- Use managed Postgres with backups and point-in-time recovery.
- Use managed Redis or Redis with persistence and monitoring.
- Add TLS termination through a reverse proxy or load balancer.
- Add DB migration deploy step before API rollout.
- Add worker heartbeat health checks.
- Add image vulnerability scanning.
- Add deployment rollback workflow.
- Store secrets in a managed secret store.
- Enable centralized logs and metrics.
