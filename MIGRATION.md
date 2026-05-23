# TypeScript Migration Plan

## Current Reality

The repository now runs through the monorepo apps: `apps/web` for the Next.js frontend, `apps/api` for the Fastify API, and `apps/worker` for BullMQ workers. Prisma and PostgreSQL live behind `packages/database`.

## Target Architecture

- `apps/web`: frontend app, with migrated React pages hosted inside the Next.js App Router.
- `apps/api`: Fastify backend app with Prisma-backed repositories.
- `packages/types`, `packages/validation`, and domain packages: reusable contracts and runtime helpers shared by active apps.
- `tsconfig.base.json`: strict shared compiler rules.
- Project-level `tsconfig.json` files opt into gradual migration with `allowJs: true` and `checkJs: false`.

## Type Architecture Decisions

- Shared DTOs should live in focused packages such as `packages/types` and `packages/validation`, grouped by responsibility instead of a single global shared package.
- Zod schemas are the contract source of truth for API boundaries. TypeScript DTOs are inferred with `z.infer`, so validation and static typing cannot silently diverge.
- API responses use a discriminated `ok: true | false` shape. Frontend code can narrow safely without guessing whether `data` or `error` exists.
- Errors use a finite `AppErrorCode` union and typed field errors. This gives backend middleware, frontend forms, and logs the same error vocabulary.
- Environment variables are parsed through app-specific schemas in the active runtimes. Runtime configuration enters each app as a typed object instead of raw `process.env` strings.
- Prisma types should stay inside the backend. Shared types expose API DTOs, while Prisma select objects and mapper functions convert database rows into transport-safe DTOs.
- Path aliases are defined at the base config and repeated per project where runtime tooling needs them. Aliases are for ownership boundaries, not hiding tangled imports.

## Shared Package Layout

- `domain.ts`: ecommerce domain DTOs and primitive schemas such as entity ids, roles, payment methods, products, carts, and orders.
- `schemas.ts`: request and response schemas for auth, products, cart, orders, and reviews.
- `api.ts`: API envelope schemas, pagination typing, and response helpers.
- `errors.ts`: application error codes, field error typing, and `AppError`.
- `validation.ts`: schema input/output helpers and Zod error normalization.

## Backend Foundation

- `apps/api/src/env.ts` validates and types API configuration.
- `apps/api/src/http/validate.ts` gives routes reusable Zod validation and rate-limit helpers.
- `apps/api/src/plugins/*` owns Fastify lifecycle, auth, database, Redis, queue, and security wiring.
- `packages/database/prisma/schema.prisma` defines the active PostgreSQL ecommerce model.

## Prisma Typing Pattern

Keep Prisma-generated types behind backend modules:

1. Define Prisma `select` objects close to repositories.
2. Query only fields needed for a DTO.
3. Map database rows into shared DTOs.
4. Return DTOs from services/controllers, never raw Prisma models.

After Prisma generation is active, tighten select objects with `satisfies Prisma.ProductSelect` and derive row types with `Prisma.ProductGetPayload`.

## Migration Phases

1. Foundation
   - Add strict TypeScript configuration.
   - Add workspace scripts and focused shared packages.
   - Add path aliases without changing runtime behavior.

2. Contracts First
   - Move API request and response shapes into focused package or app-owned modules.
   - Type frontend API clients before typing UI screens.
   - Type backend route contracts before controllers.

3. Backend Core
   - Convert config, environment parsing, middleware, and utilities first.
   - Convert services before controllers.
   - Keep controllers thin and typed around request params, body, query, and response payloads.

4. Data Layer
   - Keep Prisma/PostgreSQL behind repository modules.
   - Expose domain DTOs instead of leaking Prisma models.

5. Frontend
   - Convert API layer, contexts, route guards, and data-heavy components before presentational components.
   - Prefer typed hooks and typed API functions over passing raw server responses through the component tree.

6. Strictness Ratchet
   - Turn on `checkJs` only for directories that are actively being migrated.
   - Add ESLint TypeScript rules after the first stable TS slice exists.
   - Block new untyped modules in CI once the first migration milestone lands.

## JS-to-TS Best Practices

- Rename one vertical slice at a time, not the whole app.
- Start with boundary files: API clients, request validators, services, middleware, and database mappers.
- Use `unknown` for untrusted inputs, then narrow with validation.
- Avoid exporting database model types directly to the frontend.
- Use discriminated unions for API results instead of nullable fields.
- Prefer `type` for unions and mapped types; prefer `interface` for object contracts that may be extended.
- Use DTOs at API boundaries so internal persistence changes do not break the frontend.

## Avoid `any` Abuse

- Use `unknown` for external data.
- Use generics for reusable API helpers.
- Use `Record<string, string[]>` for field errors instead of loose objects.
- Use precise unions for enums like role and payment method.
- Reserve `any` only for documented third-party escape hatches, and isolate it in adapters.

## High-Risk Areas

- Authentication cookies, JWT payloads, and role checks.
- Payment integrations with Stripe and order state changes.
- Cart and checkout calculations.
- Prisma row shape versus API response shape.
- Error handling middleware, because Express errors are often structurally inconsistent.
- Environment variables, especially secrets and database URLs.
- Future Prisma/PostgreSQL migration, because it changes persistence semantics and should be isolated from the TypeScript rollout.

## Incremental Migration Rules

- Existing `.js` and `.jsx` files remain valid during migration.
- New shared contracts should be written in TypeScript.
- New backend modules should be `.ts` once their dependency chain is typed.
- New frontend components should be `.tsx` when they accept props or use API data.
- Every migrated slice should include a typecheck and a smoke test of the existing behavior.
