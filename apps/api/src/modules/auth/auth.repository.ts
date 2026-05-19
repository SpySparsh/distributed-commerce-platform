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

export class UnconfiguredAuthRepository implements AuthRepository {
  async findUserByEmail(): Promise<AuthUserRecord | undefined> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async findUserById(): Promise<AuthUserRecord | undefined> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async createUser(): Promise<AuthUserRecord> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async createSession(): Promise<AuthSession> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async findSessionByTokenHash(): Promise<AuthSession | undefined> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async rotateSessionToken(): Promise<void> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async revokeSession(): Promise<void> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }

  async revokeUserSessions(): Promise<void> {
    throw new Error("AuthRepository is not configured with Prisma yet.");
  }
}
