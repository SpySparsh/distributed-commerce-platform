# Async Job Architecture

## Flow

```text
API -> BullMQ Queue -> Worker
```

The API enqueues jobs through `@ecommerce/queue`. Workers consume the same typed job contract from the shared package.

## Queues

- `email`: email sending.
- `invoice`: invoice generation.
- `analytics`: analytics tracking.
- `payment-retry`: payment retry workflows.
- `stock-sync`: stock synchronization.
- `dead-letter`: failed job capture for investigation/replay.

## Shared Contract

`packages/queue` owns:

- Queue names.
- Job names.
- Zod payload schemas.
- Retry/backoff defaults.
- Idempotency key generation.
- Queue producer abstraction.

This avoids queue duplication between API and worker code.

## Retries

Retries are configured per job type:

- Email: 5 attempts, exponential backoff.
- Invoice: 3 attempts.
- Analytics: 3 attempts.
- Payment retry: 8 attempts with longer backoff.
- Stock sync: 5 attempts.

Completed jobs are retained briefly for observability. Failed jobs are retained and also copied to a dead-letter queue after final failure.

## Idempotency

Every job has `metadata.idempotencyKey`, used as BullMQ `jobId`.

Rules:

- API producers must build deterministic idempotency keys from tenant, job name, and domain identifiers.
- Workers must make side effects idempotent at the integration boundary.
- Payment retry and invoice generation must use database/provider idempotency keys before external calls.

## Failure Handling

Worker failures are logged with queue name and job id.

After final retry exhaustion, the worker enqueues a `dead-letter.record` job containing:

- Original queue.
- Original job name.
- Original job id.
- Failure reason.
- Original payload.
- Failure timestamp.

## Monitoring

`QueueEvents` is registered for each worker queue and logs completed/failed events. In production, connect these events to metrics:

- Jobs waiting.
- Jobs active.
- Jobs completed.
- Jobs failed.
- Retry counts.
- Dead-letter counts.
- Processing latency.

## Production Considerations

- Run workers independently from the API.
- Scale workers per queue based on bottleneck: email, payment, stock sync, analytics.
- Keep job payloads small; store large artifacts in object storage or PostgreSQL.
- Prefer deterministic job ids over random UUIDs for idempotent workflows.
- Treat Redis as queue infrastructure, not the source of truth for orders/payments.
- Add dashboard tooling such as Bull Board behind admin authentication later.
