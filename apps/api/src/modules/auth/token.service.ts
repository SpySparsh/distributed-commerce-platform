import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { ApiEnv } from "../../env.js";
import type { AuthTokenClaims } from "./auth.types.js";

const encoder = new TextEncoder();

export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenHash: string;
  readonly refreshTokenExpiresAt: Date;
  readonly csrfToken: string;
}

const toSecret = (secret: string): Uint8Array => encoder.encode(secret);

export const hashRefreshToken = (refreshToken: string): string =>
  createHash("sha256").update(refreshToken).digest("hex");

export const createCsrfToken = (): string => randomBytes(32).toString("base64url");

export const issueTokens = async (
  config: ApiEnv,
  claims: AuthTokenClaims
): Promise<IssuedTokens> => {
  const now = Math.floor(Date.now() / 1000);
  const refreshToken = randomBytes(64).toString("base64url");
  const csrfToken = createCsrfToken();
  const refreshTokenExpiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000);

  const accessToken = await new SignJWT({
    tenantId: claims.tenantId,
    sessionId: claims.sessionId,
    roles: claims.roles,
    permissions: claims.permissions
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + config.ACCESS_TOKEN_TTL_SECONDS)
    .sign(toSecret(config.ACCESS_TOKEN_SECRET));

  return {
    accessToken,
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenExpiresAt,
    csrfToken
  };
};

export const verifyAccessToken = async (
  config: ApiEnv,
  accessToken: string
): Promise<AuthTokenClaims> => {
  const { payload } = await jwtVerify(accessToken, toSecret(config.ACCESS_TOKEN_SECRET));

  return {
    sub: payload.sub ?? "",
    tenantId: String(payload["tenantId"]),
    sessionId: String(payload["sessionId"]),
    roles: Array.isArray(payload["roles"]) ? payload["roles"].map(String) : [],
    permissions: Array.isArray(payload["permissions"]) ? payload["permissions"].map(String) : []
  };
};
