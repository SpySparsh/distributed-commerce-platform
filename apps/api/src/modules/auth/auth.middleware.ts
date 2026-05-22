import type { FastifyReply, FastifyRequest } from "fastify";
import { forbiddenError, invalidSessionError } from "./auth.errors.js";
import type { AuthenticatedUser } from "./auth.types.js";
import { verifyAccessToken } from "./token.service.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const getBearerToken = (request: FastifyRequest): string | undefined => {
  const authorization = request.headers.authorization;

  if (authorization === undefined) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
};

export const requireAuth = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
  const token = getBearerToken(request);

  if (token === undefined) {
    throw invalidSessionError();
  }

  const claims = await verifyAccessToken(request.server.config, token).catch((error: unknown) => {
    request.log.warn({ err: error }, "Rejected invalid or expired access token");
    throw invalidSessionError();
  });

  if (claims.sub.length === 0) {
    throw invalidSessionError();
  }

  request.user = {
    id: claims.sub,
    tenantId: claims.tenantId,
    email: "",
    roles: claims.roles,
    permissions: claims.permissions
  };
};

export const requirePermission =
  (permission: string) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);

    if (!request.user?.permissions.includes(permission)) {
      throw forbiddenError();
    }
  };

export const requireRole =
  (role: string) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);

    if (!request.user?.roles.includes(role)) {
      throw forbiddenError();
    }
  };

export const getAuthenticatedTenantId = (request: FastifyRequest): string => {
  if (request.user === undefined) {
    throw invalidSessionError();
  }

  return request.user.tenantId;
};

export const getAuthenticatedUserId = (request: FastifyRequest): string => {
  if (request.user === undefined) {
    throw invalidSessionError();
  }

  return request.user.id;
};
