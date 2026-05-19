import * as Sentry from "@sentry/node";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    sentry: typeof Sentry;
  }
}

export const sentryPlugin = fp(
  async (app) => {
    if (app.config.SENTRY_DSN !== undefined) {
      Sentry.init({
        dsn: app.config.SENTRY_DSN,
        environment: app.config.NODE_ENV,
        tracesSampleRate: app.config.SENTRY_TRACES_SAMPLE_RATE
      });
    }

    app.decorate("sentry", Sentry);

    app.addHook("onRequest", async (request) => {
      Sentry.setTag("request_id", request.correlationId);
      Sentry.setContext("request", {
        method: request.method,
        url: request.url,
        requestId: request.correlationId
      });
    });

    app.addHook("onError", async (request, _reply, error) => {
      Sentry.withScope((scope) => {
        scope.setTag("request_id", request.correlationId);
        scope.setContext("request", {
          method: request.method,
          url: request.url,
          requestId: request.correlationId
        });
        Sentry.captureException(error);
      });
    });

    app.addHook("onClose", async () => {
      await Sentry.close(2000);
    });
  },
  {
    name: "sentry",
    dependencies: ["config"]
  }
);
