import type { FastifyReply } from "fastify";
import type { ApiEnv } from "../../env.js";

export const refreshCookieName = "refresh_token";

export const setAuthCookies = (
  reply: FastifyReply,
  config: ApiEnv,
  refreshToken: string,
  refreshTokenExpiresAt: Date,
  csrfToken: string
): void => {
  const baseCookie = {
    httpOnly: true,
    secure: config.AUTH_COOKIE_SECURE,
    sameSite: "strict" as const,
    path: "/auth",
    expires: refreshTokenExpiresAt,
    ...(config.AUTH_COOKIE_DOMAIN === undefined ? {} : { domain: config.AUTH_COOKIE_DOMAIN })
  };

  reply.setCookie(refreshCookieName, refreshToken, baseCookie);
  reply.setCookie(config.CSRF_COOKIE_NAME, csrfToken, {
    ...baseCookie,
    httpOnly: false
  });
};

export const clearAuthCookies = (reply: FastifyReply, config: ApiEnv): void => {
  const options = {
    path: "/auth",
    ...(config.AUTH_COOKIE_DOMAIN === undefined ? {} : { domain: config.AUTH_COOKIE_DOMAIN })
  };

  reply.clearCookie(refreshCookieName, options);
  reply.clearCookie(config.CSRF_COOKIE_NAME, options);
};
