import helmet from "@fastify/helmet";
import fp from "fastify-plugin";

export const securityHeadersPlugin = fp(
  async (app) => {
    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hidePoweredBy: true,
      hsts: app.config.NODE_ENV === "production"
    });
  },
  {
    name: "security-headers",
    dependencies: ["config"]
  }
);
