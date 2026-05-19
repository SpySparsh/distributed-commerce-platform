import type { FastifyInstance } from "fastify";

const getElapsedMs = (startedAt: bigint): number =>
  Number(process.hrtime.bigint() - startedAt) / 1_000_000;

export const registerLifecycleHooks = (app: FastifyInstance): void => {
  app.addHook("onRequest", async (request) => {
    request.log.info(
      {
        requestId: request.id,
        correlationId: request.correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    const responseTimeMs = getElapsedMs(request.startedAt);
    const logPayload = {
      requestId: request.id,
      correlationId: request.correlationId,
      method: request.method,
      url: request.url,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      responseTimeMs
    };

    if (responseTimeMs >= app.config.SLOW_API_THRESHOLD_MS) {
      request.log.warn(logPayload, "Slow request completed");
      return;
    }

    request.log.info(logPayload, "Request completed");
  });

  app.addHook("onError", async (request, _reply, error) => {
    request.log.error(
      {
        requestId: request.id,
        correlationId: request.correlationId,
        method: request.method,
        url: request.url,
        error
      },
      "Request failed"
    );
  });
};
