import type { FastifyReply, FastifyRequest } from "fastify";
import type { EmailServiceEnv } from "../env.js";

export const createInternalAuthMiddleware =
  (config: EmailServiceEnv) =>
  async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const secret = request.headers["x-email-secret"];
    const providedSecret = Array.isArray(secret) ? secret[0] : secret;

    if (providedSecret !== config.EMAIL_SERVICE_SECRET) {
      request.log.warn(
        {
          requestId: request.id,
          route: request.routeOptions.url
        },
        "Rejected unauthorized email-service request"
      );

      const error = new Error("Unauthorized");
      Object.assign(error, {
        statusCode: 401,
        code: "UNAUTHORIZED"
      });
      throw error;
    }
  };
