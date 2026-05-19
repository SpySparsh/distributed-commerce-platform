# Event-Driven Architecture

This foundation adds typed domain events, durable event logging, asynchronous dispatch, and worker-side consumers for ecommerce workflows.

## Event Contracts

Shared contracts live in `packages/events`:

- `OrderPlaced`
- `PaymentCompleted`
- `InventoryReserved`
- `CartExpired`
- `ProductUpdated`

Each event has:

- `eventId`
- `tenantId`
- `aggregateType`
- `aggregateId`
- `occurredAt`
- optional `correlationId`
- optional `causationId`
- optional `actorUserId`
- `schemaVersion`

The event payloads are validated with Zod and exported as TypeScript types.

## Publishing Flow

1. Domain service creates an event with a factory from `@ecommerce/events`.
2. API publisher validates the event.
3. Event is appended to `DomainEventLog`.
4. Event is enqueued as `domain-event.dispatch`.
5. Log row is marked `published`.

The event log gives you recovery if a publisher, queue, or worker fails between steps.

## Consuming Flow

Workers listen on the `domain-events` queue. The consumer parses the event and schedules downstream work:

- `OrderPlaced` enqueues invoice generation and analytics.
- `PaymentCompleted` enqueues analytics and can drive payment/order projections.
- `InventoryReserved` enqueues analytics.
- `CartExpired` enqueues analytics and can drive remarketing/recovery.
- `ProductUpdated` enqueues product search reindexing and analytics.

Consumers should be idempotent. Queue job IDs are derived from event IDs or aggregate IDs.

## Why This Decouples Services

Without events, order code directly calls payment, inventory, invoice, email, analytics, and search modules. That becomes brittle quickly.

With events:

- order service emits `OrderPlaced`
- invoice consumer reacts independently
- analytics consumer reacts independently
- search or notification consumers can be added without changing order code

The producer owns facts. Consumers own reactions.

## Eventual Consistency

Events are asynchronous, so read models and downstream workflows may lag briefly behind the write model.

Examples:

- product update commits before search index updates
- order placement commits before invoice generation
- cart expiration commits before recovery email/analytics

This is acceptable when the source-of-truth transaction is durable and consumers are idempotent/retryable.

## Production Considerations

- Use `DomainEventLog.status` for replay dashboards and recovery jobs.
- Add a scheduled publisher that republishes old `pending` or `failed` events.
- Keep payloads small and stable; include IDs, not full object graphs.
- Version events with `schemaVersion`.
- Prefer additive payload changes.
- Track `correlationId` across API request, event, queue job, and worker logs.
- Dead-letter failed dispatches after retries for operational triage.
