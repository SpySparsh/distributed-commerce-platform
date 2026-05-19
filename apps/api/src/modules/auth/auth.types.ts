export type AuthRole = string;
export type AuthPermission = string;

export interface AuthenticatedUser {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly roles: readonly AuthRole[];
  readonly permissions: readonly AuthPermission[];
}

export interface AuthTokenClaims {
  readonly sub: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly roles: readonly AuthRole[];
  readonly permissions: readonly AuthPermission[];
}

export interface AuthSession {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly deviceName?: string;
  readonly expiresAt: Date;
  readonly revokedAt?: Date;
}

export interface AuthUserRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly status: "active" | "invited" | "suspended" | "deleted";
  readonly roles: readonly AuthRole[];
  readonly permissions: readonly AuthPermission[];
}

export interface SafeUserResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly roles: readonly AuthRole[];
  readonly permissions: readonly AuthPermission[];
}

export interface AuthResponse {
  readonly user: SafeUserResponse;
  readonly accessToken: string;
  readonly csrfToken: string;
}
