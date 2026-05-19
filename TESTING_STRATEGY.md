# Backend Testing Strategy

This backend uses Vitest and Supertest with a layered testing model.

## Test Layers

- Unit tests: pure services, state machines, validation, queue schemas, provider adapters.
- API tests: HTTP boundary checks through Fastify and Supertest.
- Integration tests: database, Redis, BullMQ, Meilisearch, and external-adapter behavior.
- Contract tests: shared package schemas such as queues and domain events.

## Commands

```bash
corepack pnpm test
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:coverage
```

Integration tests are gated behind `RUN_INTEGRATION=true` so local unit runs do not accidentally depend on PostgreSQL, Redis, or Meilisearch.

## Test Utilities

API test helpers live under `apps/api/src/test-utils`:

- `createTestApiEnv`: strict typed test environment.
- `FakeRedisCacheClient`: in-memory Redis contract for service tests.
- `testIds`: stable UUID fixtures.

Shared utilities prevent duplicated setup and keep tests readable.

## Critical Flow Coverage

Current foundation covers:

- Authentication: registration, password hashing, session token rotation, duplicate protection.
- Payments: signed webhook verification and invalid signature rejection.
- Inventory reservation: lock acquisition and lock failure behavior.
- Carts: guest cart merge behavior.
- Orders: state-machine transition rules.
- Queues: payload schema validation, routing, retry/idempotency options.
- API: health endpoint and standardized error response shape.

## Database Strategy

Use a dedicated test database, never the development database:

```text
DATABASE_URL=postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_test?schema=public
```

Recommended integration lifecycle:

1. Create/reset test database before the suite.
2. Run Prisma migrations.
3. Use one transaction per test when possible.
4. Roll back after each test.
5. Use deterministic seed builders for tenants, users, products, inventory, carts, orders, and payments.

For workflows that cannot run inside one transaction, use per-test tenant IDs and cleanup by tenant.

## API Testing

Use Supertest against Fastify `app.server`. Keep API tests focused on:

- request/response contract
- status codes
- validation formatting
- auth/cookie behavior
- idempotency headers/keys

Do not duplicate every service branch through HTTP tests. Service tests should cover business branching; API tests should cover protocol behavior.

## Integration Coverage Priorities

High-value integration tests:

- register -> login -> refresh -> logout
- reserve inventory -> create order -> payment webhook -> paid order
- failed payment -> retry job scheduled
- guest cart -> login cart merge
- product update -> search indexing job
- queue failure -> dead-letter routing

## Tradeoffs

- Unit tests are fast and isolate business rules, but can miss wiring issues.
- API tests catch boundary regressions, but become brittle if they assert too much internal structure.
- Integration tests catch real infrastructure problems, but are slower and require strict isolation.
- Contract/schema tests are cheap insurance for async workflows because producer and consumer code evolve separately.

The goal is not maximum test count. The goal is fast feedback on business invariants and high confidence on the seams where systems meet.
