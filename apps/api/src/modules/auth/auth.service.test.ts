import { describe, expect, it } from "vitest";
import { createTestApiEnv } from "../../test-utils/api-env.js";
import { testIds } from "../../test-utils/ids.js";
import type { AuthRepository, CreateSessionInput, CreateUserInput } from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";
import type { AuthSession, AuthUserRecord } from "./auth.types.js";

class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, AuthUserRecord>();
  readonly sessions = new Map<string, AuthSession>();

  async findUserByEmail(tenantId: string, email: string): Promise<AuthUserRecord | undefined> {
    return [...this.users.values()].find((user) => user.tenantId === tenantId && user.email === email);
  }

  async findUserById(tenantId: string, userId: string): Promise<AuthUserRecord | undefined> {
    const user = this.users.get(userId);
    return user?.tenantId === tenantId ? user : undefined;
  }

  async createUser(input: CreateUserInput): Promise<AuthUserRecord> {
    const user: AuthUserRecord = {
      id: testIds.userId,
      tenantId: input.tenantId,
      email: input.email,
      passwordHash: input.passwordHash,
      status: "active",
      roles: ["customer"],
      permissions: ["orders:read"]
    };
    this.users.set(user.id, user);
    return user;
  }

  async createSession(input: CreateSessionInput): Promise<AuthSession> {
    const session: AuthSession = {
      id: testIds.sessionId,
      tenantId: input.tenantId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
      ...(input.ipAddress === undefined ? {} : { ipAddress: input.ipAddress }),
      ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName })
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | undefined> {
    return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash);
  }

  async rotateSessionToken(sessionId: string, nextTokenHash: string, expiresAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session !== undefined) {
      this.sessions.set(sessionId, {
        ...session,
        tokenHash: nextTokenHash,
        expiresAt
      });
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session !== undefined) {
      this.sessions.set(sessionId, {
        ...session,
        revokedAt: new Date()
      });
    }
  }

  async revokeUserSessions(): Promise<void> {}
}

describe("auth service", () => {
  it("registers users with hashed passwords and rotates refresh token storage", async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService(createTestApiEnv(), repository);

    const response = await service.register({
      tenantId: testIds.tenantId,
      email: "buyer@example.com",
      password: "Str0ng-password!",
      firstName: "Test"
    }, {
      ipAddress: "127.0.0.1",
      userAgent: "vitest"
    });

    const user = repository.users.get(testIds.userId);
    const session = repository.sessions.get(testIds.sessionId);

    expect(response.accessToken.length).toBeGreaterThan(20);
    expect(response.refreshToken.length).toBeGreaterThan(20);
    expect(user?.passwordHash).not.toBe("Str0ng-password!");
    expect(session?.tokenHash).not.toBe("pending");
  });

  it("rejects duplicate registration without leaking existence semantics", async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService(createTestApiEnv(), repository);

    await service.register({
      tenantId: testIds.tenantId,
      email: "buyer@example.com",
      password: "Str0ng-password!"
    }, {});

    await expect(service.register({
      tenantId: testIds.tenantId,
      email: "buyer@example.com",
      password: "Str0ng-password!"
    }, {})).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
  });
});
