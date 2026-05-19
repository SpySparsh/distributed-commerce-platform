import type { ApiEnv } from "../../env.js";
import type { AuthRepository } from "./auth.repository.js";
import { invalidCredentialsError, invalidSessionError } from "./auth.errors.js";
import type { AuthResponse, AuthSession, AuthUserRecord, SafeUserResponse } from "./auth.types.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { hashRefreshToken, issueTokens } from "./token.service.js";
import type { LoginBody, RegisterBody } from "./auth.schemas.js";

export interface RequestDeviceContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface AuthSessionResponse extends AuthResponse {
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

export interface AuthService {
  register(input: RegisterBody, device: RequestDeviceContext): Promise<AuthSessionResponse>;
  login(input: LoginBody, device: RequestDeviceContext): Promise<AuthSessionResponse>;
  refresh(
    refreshToken: string | undefined,
    csrfCookie: string | undefined,
    csrfBody: string
  ): Promise<AuthSessionResponse>;
  logout(refreshToken: string | undefined): Promise<void>;
}

const toSafeUser = (user: AuthUserRecord): SafeUserResponse => ({
  id: user.id,
  tenantId: user.tenantId,
  email: user.email,
  roles: user.roles,
  permissions: user.permissions
});

const createAuthResponse = async (
  config: ApiEnv,
  repository: AuthRepository,
  user: AuthUserRecord,
  session: AuthSession
): Promise<AuthSessionResponse> => {
  const tokens = await issueTokens(config, {
    sub: user.id,
    tenantId: user.tenantId,
    sessionId: session.id,
    roles: user.roles,
    permissions: user.permissions
  });

  await repository.rotateSessionToken(session.id, tokens.refreshTokenHash, tokens.refreshTokenExpiresAt);

  return {
    user: toSafeUser(user),
    accessToken: tokens.accessToken,
    csrfToken: tokens.csrfToken,
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
  };
};

export const createAuthService = (config: ApiEnv, repository: AuthRepository): AuthService => ({
  async register(input, device) {
    const existingUser = await repository.findUserByEmail(input.tenantId, input.email);

    if (existingUser !== undefined) {
      throw invalidCredentialsError();
    }

    const passwordHash = await hashPassword(input.password);
    const user = await repository.createUser({
      tenantId: input.tenantId,
      email: input.email,
      passwordHash,
      ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
      ...(input.lastName === undefined ? {} : { lastName: input.lastName })
    });

    const session = await repository.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: "pending",
      ...(device.ipAddress === undefined ? {} : { ipAddress: device.ipAddress }),
      ...(device.userAgent === undefined ? {} : { userAgent: device.userAgent }),
      expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000)
    });

    return createAuthResponse(config, repository, user, session);
  },

  async login(input, device) {
    const user = await repository.findUserByEmail(input.tenantId, input.email);

    if (user === undefined || user.status !== "active") {
      throw invalidCredentialsError();
    }

    const passwordIsValid = await verifyPassword(input.password, user.passwordHash);

    if (!passwordIsValid) {
      throw invalidCredentialsError();
    }

    const session = await repository.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: "pending",
      ...(device.ipAddress === undefined ? {} : { ipAddress: device.ipAddress }),
      ...(device.userAgent === undefined ? {} : { userAgent: device.userAgent }),
      ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
      expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000)
    });

    return createAuthResponse(config, repository, user, session);
  },

  async refresh(refreshToken, csrfCookie, csrfBody) {
    if (refreshToken === undefined || csrfCookie === undefined || csrfCookie !== csrfBody) {
      throw invalidSessionError();
    }

    const session = await repository.findSessionByTokenHash(hashRefreshToken(refreshToken));

    if (
      session === undefined ||
      session.revokedAt !== undefined ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw invalidSessionError();
    }

    const user = await repository.findUserById(session.tenantId, session.userId);

    if (user === undefined || user.status !== "active") {
      throw invalidSessionError();
    }

    return createAuthResponse(config, repository, user, session);
  },

  async logout(refreshToken) {
    if (refreshToken === undefined) {
      return;
    }

    const session = await repository.findSessionByTokenHash(hashRefreshToken(refreshToken));

    if (session !== undefined) {
      await repository.revokeSession(session.id);
    }
  }
});
