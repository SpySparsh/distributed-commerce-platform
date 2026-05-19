import type { PrismaClient } from "@ecommerce/database";
import type {
  AuthPermission,
  AuthRole,
  AuthSession,
  AuthUserRecord
} from "./auth.types.js";
import type { AuthRepository, CreateSessionInput, CreateUserInput } from "./auth.repository.js";

interface PrismaUserRoleRecord {
  readonly role: {
    readonly key: string;
    readonly rolePermissions: readonly {
      readonly permission: {
        readonly key: string;
      };
    }[];
  };
}

interface PrismaUserRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly status: "active" | "invited" | "suspended" | "deleted";
  readonly userRoles: readonly PrismaUserRoleRecord[];
}

interface PrismaSessionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly deviceName: string | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

const userInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  }
} as const;

const toUserRecord = (user: PrismaUserRecord): AuthUserRecord => {
  const roles: AuthRole[] = [];
  const permissions = new Set<AuthPermission>();

  for (const userRole of user.userRoles) {
    roles.push(userRole.role.key);

    for (const rolePermission of userRole.role.rolePermissions) {
      permissions.add(rolePermission.permission.key);
    }
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    passwordHash: user.passwordHash,
    status: user.status,
    roles,
    permissions: [...permissions]
  };
};

const toSession = (session: PrismaSessionRecord): AuthSession => ({
  id: session.id,
  tenantId: session.tenantId,
  userId: session.userId,
  tokenHash: session.tokenHash,
  expiresAt: session.expiresAt,
  ...(session.userAgent === null ? {} : { userAgent: session.userAgent }),
  ...(session.ipAddress === null ? {} : { ipAddress: session.ipAddress }),
  ...(session.deviceName === null ? {} : { deviceName: session.deviceName }),
  ...(session.revokedAt === null ? {} : { revokedAt: session.revokedAt })
});

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(tenantId: string, email: string): Promise<AuthUserRecord | undefined> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email,
        deletedAt: null
      },
      include: userInclude
    });

    return user === null ? undefined : toUserRecord(user);
  }

  async findUserById(tenantId: string, userId: string): Promise<AuthUserRecord | undefined> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null
      },
      include: userInclude
    });

    return user === null ? undefined : toUserRecord(user);
  }

  async createUser(input: CreateUserInput): Promise<AuthUserRecord> {
    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
        ...(input.lastName === undefined ? {} : { lastName: input.lastName })
      },
      include: userInclude
    });

    return toUserRecord(user);
  }

  async createSession(input: CreateSessionInput): Promise<AuthSession> {
    const session = await this.prisma.session.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ...(input.ipAddress === undefined ? {} : { ipAddress: input.ipAddress }),
        ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
        ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName })
      }
    });

    return toSession(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | undefined> {
    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash
      }
    });

    return session === null ? undefined : toSession(session);
  }

  async rotateSessionToken(
    sessionId: string,
    nextTokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    await this.prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        tokenHash: nextTokenHash,
        expiresAt,
        revokedAt: null
      }
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async revokeUserSessions(tenantId: string, userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tenantId,
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
}
