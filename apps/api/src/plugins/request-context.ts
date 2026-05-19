import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

export const requestContextPlugin = fp(
  async (app) => {
    app.decorateRequest("correlationId", "");

    app.addHook("onRequest", async (request, reply) => {
      request.correlationId = request.id;
      reply.header(app.config.REQUEST_ID_HEADER, request.correlationId);
    });
  },
  {
    name: "request-context",
    dependencies: ["config"]
  }
);
