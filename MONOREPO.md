# Monorepo Architecture

## Runtime Apps

- `apps/web`: Next.js customer/admin frontend.
- `apps/api`: Fastify HTTP API.
- `apps/worker`: BullMQ background workers and scheduled jobs.

Legacy folders remain in place during migration:

- `ecommerce-frontend`: current Vite frontend.
- `server`: current Express/Mongoose backend.

The new `apps/*` tree is intentionally empty of business logic so migration can happen slice by slice.

## Shared Packages

- `packages/database`: Prisma schema/client boundary and database-only helpers.
- `packages/logger`: structured logging contract.
- `packages/validation`: Zod schemas and request validation primitives.
- `packages/config`: shared TypeScript, ESLint, Prettier, and environment config.
- `packages/types`: cross-app DTOs and type contracts.
- `packages/ui`: design-system primitives for the Next.js app.

## Local Infrastructure

- `docker-compose.yml` runs PostgreSQL and Redis for local development.
- `apps/web/Dockerfile`, `apps/api/Dockerfile`, and `apps/worker/Dockerfile` establish separate deployable units.
- `.env.example` documents runtime configuration without committing secrets.

## Decisions

- Apps own runtime entrypoints. Packages own reusable infrastructure and contracts.
- Shared packages are small and named by responsibility, not by vague utility buckets.
- Prisma types stay behind `packages/database`; public API contracts live in `packages/types`.
- Environment variables are parsed per runtime with shared helpers from `packages/config`.
- Turborepo runs dependency-aware tasks; pnpm workspaces provide deterministic package boundaries.
- TypeScript stays strict at the base layer, with per-app configs only adjusting runtime needs.
- Docker images are app-specific. The API, web app, and workers should be deployed and scaled independently.
