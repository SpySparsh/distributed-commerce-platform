# Observability Architecture

## Structured Logs

`packages/logger` owns the shared Pino configuration:

- ISO timestamps.
- Service and environment base fields.
- Consistent log levels.
- Redaction for authorization, cookies, passwords, and tokens.

The API and worker both consume this shared logger setup.

## Request Tracing

Fastify request IDs are used as correlation IDs.

- Incoming request ID is read from `REQUEST_ID_HEADER`.
- The API echoes the correlation ID on every response.
- Logs include `requestId`, `correlationId`, method, URL, route, status, and latency.

## Sentry

`sentryPlugin` initializes `@sentry/node` when `SENTRY_DSN` is configured.

Captured context:

- request ID
- method
- URL
- environment

Errors are captured from Fastify `onError` hooks and still flow through the centralized API error response handler.

## Latency Monitoring

Request start time is recorded with `process.hrtime.bigint()`.

`onResponse` logs:

- route
- status code
- response time in milliseconds

Requests slower than `SLOW_API_THRESHOLD_MS` are logged at `warn` level.

## Slow Query Tracking

Database query timing should be added at the Prisma client wrapper layer:

- measure query duration with Prisma middleware or client extensions
- log queries above a configured threshold
- include tenant ID and request ID when available
- never log sensitive bind values

The current foundation adds slow API tracking first; database instrumentation should live in `packages/database`.

## Production Debugging

Every production incident should be traceable through:

- correlation ID in response headers
- API logs by correlation ID
- Sentry event tags
- worker job IDs and idempotency keys
- queue failure logs and dead-letter records

## Tradeoffs

- Logs are structured JSON, optimized for ingestion rather than local prettiness.
- Sentry is optional by env config so local development does not require credentials.
- Slow requests are warning logs instead of metrics for now; Prometheus/OpenTelemetry can be added later without changing route code.
