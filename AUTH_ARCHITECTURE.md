# Authentication Architecture

## Token Model

- Access tokens are short-lived JWTs.
- Refresh tokens are opaque random secrets, not JWTs.
- Refresh tokens are stored only in HTTP-only cookies.
- Only SHA-256 refresh token hashes are persisted in the `Session` table.
- Refresh rotates the refresh token on every successful refresh.

## Session Model

Sessions are durable PostgreSQL records:

- `tenantId` scopes every session.
- `tokenHash` uniquely identifies the active refresh token.
- `revokedAt` invalidates logout and administrative revocation.
- `expiresAt` limits refresh lifetime.
- `ipAddress`, `userAgent`, and `deviceName` support device/session tracking.

## Request Flow

Register/login:

1. Validate request body with Zod.
2. Hash password with bcrypt.
3. Create user/session through the auth repository.
4. Issue a short-lived access JWT.
5. Store rotated refresh token in an HTTP-only cookie.
6. Return access token and CSRF token to the client.

Refresh:

1. Read refresh token from HTTP-only cookie.
2. Verify double-submit CSRF token.
3. Hash refresh token and find session.
4. Reject revoked or expired sessions.
5. Rotate refresh token hash in the session row.
6. Return a new access token and CSRF token.

Logout:

1. Hash refresh token from cookie.
2. Revoke matching session.
3. Clear refresh and CSRF cookies.

## RBAC

Authorization is centralized in `auth.middleware.ts`:

- `requireAuth` verifies access token claims.
- `requireRole(role)` checks role membership.
- `requirePermission(permission)` checks permission membership.

Roles and permissions are normalized in the database. Access tokens carry role and permission snapshots for low-latency checks; sensitive operations can still re-read permissions from the database.

## CSRF Strategy

Refresh tokens live in cookies, so refresh/logout endpoints need CSRF protection.

This architecture uses double-submit CSRF:

- Server sets a non-HTTP-only CSRF cookie.
- Client sends the same token in the refresh request body or configured header.
- Server compares cookie and submitted token before rotating refresh tokens.

Access tokens should be held in memory by the frontend, not localStorage.

## Security Decisions

- No localStorage refresh tokens.
- No long-lived JWT sessions.
- No raw refresh token persistence.
- Rotation detects stale refresh token reuse once repository-level revocation policies are added.
- Password hashes are isolated behind `password.service.ts`.
- Auth routes do not contain persistence or crypto logic.
- Repository boundary allows Prisma transactions and audit logs without coupling routes to Prisma.

## Production Follow-Ups

- Wire `PrismaAuthRepository` to the generated Prisma client in the database plugin.
- Add transaction wrapping for register/login/session rotation.
- Add rate limiting on login/register/refresh.
- Add audit log writes for login, logout, refresh, and failed login.
- Add refresh-token reuse detection that revokes all user sessions after a stale token is observed.
- Add secure cookie domain per environment.
