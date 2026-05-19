import type { FastifyInstance } from "fastify";

export const registerLifecycleHooks = (app: FastifyInstance): void => {
  app.addHook("onRequest", async (request) => {
    request.log.info(
      {
        correlationId: request.correlationId,
        method: request.method,
        url: request.url
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        correlationId: request.correlationId,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime
      },
      "Request completed"
    );
  });

  app.addHook("onError", async (request, _reply, error) => {
    request.log.error(
      {
        correlationId: request.correlationId,
        error
      },
      "Request failed"
    );
  });
};
