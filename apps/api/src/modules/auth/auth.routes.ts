import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { AuthRepository } from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";
import { clearAuthCookies, refreshCookieName, setAuthCookies } from "./auth.cookies.js";
import { loginBodySchema, refreshBodySchema, registerBodySchema } from "./auth.schemas.js";
import type { RequestDeviceContext } from "./auth.service.js";
import { validateRequest, withRateLimit } from "../../http/validate.js";

const getDeviceContext = (request: FastifyRequest): RequestDeviceContext => {
  const userAgent = request.headers["user-agent"];

  return {
    ipAddress: request.ip,
    ...(userAgent === undefined ? {} : { userAgent })
  };
};

export interface AuthRouteOptions {
  readonly repository: AuthRepository;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  const authService = createAuthService(app.config, options.repository);

  app.post("/register", {
    preHandler: [
      withRateLimit({ keyPrefix: "auth:register", maxRequests: app.config.AUTH_RATE_LIMIT_MAX_REQUESTS }),
      validateRequest({ body: registerBodySchema })
    ]
  }, async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const response = await authService.register(body, getDeviceContext(request));

    setAuthCookies(
      reply,
      app.config,
      response.refreshToken,
      response.refreshTokenExpiresAt,
      response.csrfToken
    );

    return {
      ok: true,
      data: {
        user: response.user,
        accessToken: response.accessToken,
        csrfToken: response.csrfToken
      }
    };
  });

  app.post("/login", {
    preHandler: [
      withRateLimit({ keyPrefix: "auth:login", maxRequests: app.config.AUTH_RATE_LIMIT_MAX_REQUESTS }),
      validateRequest({ body: loginBodySchema })
    ]
  }, async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const response = await authService.login(body, getDeviceContext(request));

    setAuthCookies(
      reply,
      app.config,
      response.refreshToken,
      response.refreshTokenExpiresAt,
      response.csrfToken
    );

    return {
      ok: true,
      data: {
        user: response.user,
        accessToken: response.accessToken,
        csrfToken: response.csrfToken
      }
    };
  });

  app.post("/refresh", {
    preHandler: [
      withRateLimit({ keyPrefix: "auth:refresh", maxRequests: app.config.AUTH_RATE_LIMIT_MAX_REQUESTS }),
      validateRequest({ body: refreshBodySchema })
    ]
  }, async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    const response = await authService.refresh(
      request.cookies[refreshCookieName],
      request.cookies[app.config.CSRF_COOKIE_NAME],
      body.csrfToken
    );

    setAuthCookies(
      reply,
      app.config,
      response.refreshToken,
      response.refreshTokenExpiresAt,
      response.csrfToken
    );

    return {
      ok: true,
      data: {
        user: response.user,
        accessToken: response.accessToken,
        csrfToken: response.csrfToken
      }
    };
  });

  app.post("/logout", {
    preHandler: [withRateLimit({ keyPrefix: "auth:logout" })]
  }, async (request, reply) => {
    await authService.logout(request.cookies[refreshCookieName]);
    clearAuthCookies(reply, app.config);

    return {
      ok: true,
      data: {
        loggedOut: true
      }
    };
  });
};
