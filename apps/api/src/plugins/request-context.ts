import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
    startedAt: bigint;
  }
}

export const requestContextPlugin = fp(
  async (app) => {
    app.decorateRequest("correlationId", "");
    app.decorateRequest("startedAt", BigInt(0));

    app.addHook("onRequest", async (request, reply) => {
      request.correlationId = request.id;
      request.startedAt = process.hrtime.bigint();
      reply.header(app.config.REQUEST_ID_HEADER, request.correlationId);
    });
  },
  {
    name: "request-context",
    dependencies: ["config"]
  }
);
