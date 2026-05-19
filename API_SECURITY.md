# API Validation and Security Architecture

## Validation

- Shared validation primitives live in `packages/validation`.
- Fastify route validation uses `validateRequest({ body, query, params })` from `apps/api/src/http/validate.ts`.
- Zod validation errors are normalized into field errors through `RequestValidationError`.
- Routes attach schemas through `preHandler`; route handlers should not own validation rules.

## Sanitization

- `sanitizationPlugin` runs before validation.
- It trims strings and removes null/control characters from body, query, and params.
- Sanitization is intentionally conservative; output encoding still belongs at render boundaries.

## Rate Limiting

- `rateLimitPlugin` applies a Redis-backed global IP limit to all requests.
- `withRateLimit()` adds stricter route-level limits for sensitive flows like auth.
- Keys include tenant when available: `rate-limit:{tenantId}:{scope}:{ip}`.
- Response headers expose `ratelimit-limit`, `ratelimit-remaining`, and `ratelimit-reset`.

## Security Headers

- `securityHeadersPlugin` uses Helmet through `@fastify/helmet`.
- HSTS is enabled only in production.
- CSP is left off at the API layer because JSON APIs usually enforce CSP at the frontend edge.

## CORS

- Origins are allow-listed from `CORS_ORIGIN`.
- Credentials are enabled for HTTP-only auth cookies.
- Allowed headers include `authorization`, `content-type`, and the configured CSRF header.
- The request ID header is exposed for client-side correlation.

## Scalability Decisions

- Validation is schema-first and reusable across modules.
- Rate limiting uses Redis so limits work across multiple API instances.
- Plugins own infrastructure concerns; feature modules only compose the middleware they need.
- Error formatting is centralized, so clients receive stable response shapes.
- Route-level rate limits are additive to global limits for high-risk endpoints.
