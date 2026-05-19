import type { AuthSession, AuthUserRecord } from "./auth.types.js";

export interface CreateUserInput {
  readonly tenantId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

export interface CreateSessionInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly deviceName?: string;
  readonly expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(tenantId: string, email: string): Promise<AuthUserRecord | undefined>;
  findUserById(tenantId: string, userId: string): Promise<AuthUserRecord | undefined>;
  createUser(input: CreateUserInput): Promise<AuthUserRecord>;
  createSession(input: CreateSessionInput): Promise<AuthSession>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | undefined>;
  rotateSessionToken(sessionId: string, nextTokenHash: string, expiresAt: Date): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  revokeUserSessions(tenantId: string, userId: string): Promise<void>;
}
